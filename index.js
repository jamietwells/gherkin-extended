import { readFile } from 'fs/promises';
import pkg from 'parsimmon';
const { string, newline, whitespace, regexp, noneOf, seq, alt, eof, end } = pkg;

const stepIdentifiers = [
    `Given`,
    `When`,
    `Then`,
    `And`,
    `But`,
    `*`
];

const keywords = [
    `Feature`,
    `Rule`,
    `Example`,
    `Scenario`,
    `Background`,
    `Scenario Outline`,
    `Scenario Template`,
    `Examples`,
    `Scenarios`,
    `"""`,
    `|`,
    `@`,
    `#`,
    ...stepIdentifiers
];

const RestOfLine = seq(noneOf('\r\n').desc('content').many().tie(), end).map(r => r[0]);

const Parameter = seq(string(`<`), noneOf('>').many().tie(), string('>')).map(([_1, chars, _2]) => ({ type: 'Parameter', name: chars }));

const RegularText = noneOf('\r\n<').atLeast(1).tie().map((chars) => ({ type: 'Regular Text', text: chars }));

const ParmeterizedLine = seq(Parameter.or(RegularText).many(), end);

const HorizontalWhitespace = regexp(/[^\S\r\n]/).desc(`horizontal whitespace`);

const NonWhitespaceOrAtSymbol = regexp(/[^\s@]/).desc(`non-whitespace`);

const Comment = seq(whitespace.many(), string('#'), HorizontalWhitespace.many(), RestOfLine).desc('comment').map((r) => ({ type: 'Comment', comment: r[3] }));

const BlankLine = seq(HorizontalWhitespace.many(), newline).desc('blank line').map(_ => ({ type: 'BlankLine' }));

const Indentation = level => string('  ').desc(`indentation of ${level * 2} spaces`).times(level);

const Step = level => word => seq(Indentation(level), string(word), HorizontalWhitespace.many(), ParmeterizedLine).desc(`${word} step`).map(([_1, _2, _3, title]) => ({ type: `Step`, word, title }));

const CellContent = regexp(/[^|\r\n]+/).map(content => content.trim());

const TableCell = seq(string('|'), CellContent).map(result => result[1]);

const TableLine = seq(TableCell.many(), string('|'))
    .map(result => result[0]);

const SingleTableRow = level => seq(Indentation(level), TableLine, end).map((r) => ({ type: `TableRow`, Cells: r[1] }));

const Table = level => seq(SingleTableRow(level), alt(SingleTableRow(level), BlankLinesOrComments).many()).map(r => ({ type: `Table`, Rows: r }));

const StepLineOrTableBlock = level => alt(...stepIdentifiers.map(Step(level)), Table(level + 1));

const DescriptionStop = alt(...keywords.map(w => string(w)));

const DescriptionParser = level => seq(Indentation(level + 1).notFollowedBy(DescriptionStop), RestOfLine).map(l => l[1]).many().tieWith("\n").map(l => ({ description: l }));

const TitleLine = name => level => seq(Indentation(level), string(name).desc(name), string(':'), HorizontalWhitespace.many(), ParmeterizedLine, DescriptionParser(level), BlankLinesOrComments.many())
    .map(([_1, _2, _3, _4, title, description]) => ({ type: name, title, ...description }));

const [ ScenarioOutlineTitle, BackgroundTitle, ScenarioTitle, FeatureTitle, RuleTitle, ExampleTitle ] =
    [`Scenario Outline`, `Background`, `Scenario`, `Feature`, `Rule`, `Example`].map(TitleLine);

const BlankLinesOrComments = alt(Comment, BlankLine);

const ExamplesTitle = level => seq(Indentation(level), string(`Examples`), string(':'), HorizontalWhitespace.many(), end)
    .map(() => ({ type: `Examples` }));

const ExamplesBlock = level => seq(ExamplesTitle(level), Table(level + 1)).map(([title, table]) => ({ ...title, Table: table }));

const ExampleBlock = level => seq(ExampleTitle(level), alt(StepLineOrTableBlock(level + 1), BlankLinesOrComments).many()).map(([title, steps]) => ({ ...title, steps }));

const BackgroundBlock = level => seq(BackgroundTitle(level), alt(StepLineOrTableBlock(level + 1), BlankLinesOrComments).many()).map(([title, steps]) => ({ ...title, steps }));

const ScenarioOutlineBlock = level => seq(ScenarioOutlineTitle(level), alt(StepLineOrTableBlock(level + 1), BlankLinesOrComments).many(), ExamplesBlock(level + 1).atMost(1)).map(([title, steps, example]) => ({ ...title, steps, Examples: example }));

const Tag = seq(string(`@`), NonWhitespaceOrAtSymbol.many().tie()).map(r => ({ type: `Tag`, value: r[1] }));

const Tags = level => seq(Indentation(level), Tag.sepBy(HorizontalWhitespace.atLeast(1)), end).map(([indent, tags]) => tags);

const ScenarioBlock = level => seq(Tags(level).atMost(1), ScenarioTitle(level), alt(StepLineOrTableBlock(level + 1), BlankLinesOrComments).many()).map(([tags, title, steps]) => ({ ...title, tags: tags.flat(), steps }));

const RuleBlock = level => seq(Tags(level).atMost(1), RuleTitle(level), ExampleBlock(level + 1).many()).map(([tags, title, examples]) => ({ ...title, tags: tags.flat(), examples }));

const FeatureBlock = level => seq(FeatureTitle(level), alt(ScenarioOutlineBlock(level + 1), RuleBlock(level + 1), BackgroundBlock(level + 1), ScenarioBlock(level + 1), BlankLinesOrComments).many())
    .map(([feature, scenarios]) => ({ ...feature, scenarios }));

const GherkinParser = seq(alt(BlankLinesOrComments, ScenarioBlock(0), FeatureBlock(0), RuleBlock(0)).many(), eof).map(r => r[0]);

// Function to parse a Gherkin file
async function parseGherkin(name) {
    function printErrorMessage(error, textSample) {
        // Destructure error object
        const { index, expected } = error;
        const { offset, line, column } = index;

        // Split text sample into lines
        const lines = textSample.split('\n');

        // Check if line number is within the range
        if (line - 1 < lines.length) {
            console.error('Error detected:');
            console.error(`Expected: ${expected.join(', ')}`);
            console.error(`At line ${line}, column ${column} (offset ${offset}):`);

            // Print the line with error
            console.error(lines[line - 1]);

            // Print a pointer to the error location
            if (column > 0) {
                let pointer = ' '.repeat(column - 1) + '^';
                console.error(pointer);
            }
            console.error(`<`);
        } else {
            console.error('Error line number is out of range of the text sample.');
        }
    }

    console.log(`Output of ${name}`);
    const text = await readFile(`./examples/${name}.feature`, { encoding: 'utf8' });
    const result = GherkinParser.parse(text);
    if (result.status) {
        console.log('Parsed Gherkin:', JSON.stringify(result.value, null, 2));
    } else {
        printErrorMessage(result, text);
    }
    return result.status ? [ ] : [name];
}

console.log([
    ... await parseGherkin(`small`),
    ... await parseGherkin(`medium`),
    ... await parseGherkin(`descriptions`),
    ... await parseGherkin(`background`),
    ... await parseGherkin(`parameters`),
    ... await parseGherkin(`tags`),
    ... await parseGherkin(`full`),
]);
/*
Features to test:
 - Parsing decriptions
   - Include keywords inside descriptions, full makrdown etc
   - They only stop when the intent is perfect and there's a keyword directly after - doesn't need the :
 - Comments
   - With crazy things in the comments like keywords, # symbols, :, etc
 - Blank lines
 - Parameters - what can you write between <>? We actually don't know yet what is legal. Whitespace? Newlines? Punctuation? Greek Letters? Anything?
 - Breaking lines over whitespace. e.g comments
      #
        Is this a comment? Shouldn't be.
*/