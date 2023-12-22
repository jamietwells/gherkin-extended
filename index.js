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
    ...stepIdentifiers
];

const RestOfLine = seq(noneOf('\r\n').desc('content').many().map(chars => chars.join('')), end).map(r => r[0]);

const Parameter = seq(string(`<`), noneOf('>').many(), string('>')).map(([_1, chars, _2]) => ({ type: 'Parameter', name: chars.join('') }));

const RegularText = noneOf('\r\n<').atLeast(1).map((chars) => ({ type: 'Regular Text', text: chars.join('') }));

const ParmeterizedLine = seq(Parameter.or(RegularText).many(), end);

const HorizontalWhitespace = regexp(/[^\S\r\n]/).desc(`horizontal whitespace`);

const Comment = seq(whitespace.many(), string('#'), HorizontalWhitespace.many(), RestOfLine).desc('comment').map((r) => ({ type: 'Comment', comment: r[3] }));

const BlankLine = seq(HorizontalWhitespace.many(), newline).desc('blank line').map(_ => ({ type: 'BlankLine' }));

const Indentation = level => string('  ').desc('indentation').times(level);

const Step = level => word => seq(Indentation(level), string(word), HorizontalWhitespace.many(), ParmeterizedLine).map(([_1, _2, _3, title]) => ({ type: `Step`, word, title }));

const AnyStep = level => alt(...stepIdentifiers.map(Step(level)));

const DescriptionStop = alt(...keywords.map(w => string(w)));

const DescriptionParser = level => seq(Indentation(level + 1).notFollowedBy(DescriptionStop), RestOfLine).many().map(r => r.map(l => l[1]).join("\n"))

const TitleLine = name => level => seq(Indentation(level), string(name).desc(name), string(':'), HorizontalWhitespace.many(), ParmeterizedLine, DescriptionParser(level))
    .map(([_1, _2, _3, _4, title, description]) => ({ type: name, title, description }));

const [ScenarioOutlineTitle, BackgroundTitle, ScenarioTitle, FeatureTitle] = [`Scenario Outline`, `Background`, `Scenario`, `Feature`].map(TitleLine);

const BlankLinesOrComments = [Comment, BlankLine];

const ExampleTitle = level => seq(Indentation(level), string(`Example`).desc(`Example`), string(':'), HorizontalWhitespace.many())
    .map(() => ({ type: `Example` }));

const ExampleBlock = level => seq(ExampleTitle(level), alt(AnyStep(level + 1), ...BlankLinesOrComments).many()).map(([title, steps]) => ({ ...title, steps }));

const BackgroundBlock = level => seq(BackgroundTitle(level), alt(AnyStep(level + 1), ...BlankLinesOrComments).many()).map(([title, steps]) => ({ ...title, steps }));

const ScenarioOutlineBlock = level => seq(ScenarioOutlineTitle(level), alt(AnyStep(level + 1), ...BlankLinesOrComments).many()).map(([title, steps]) => ({ ...title, steps }));

const ScenarioBlock = level => seq(ScenarioTitle(level), alt(AnyStep(level + 1), ...BlankLinesOrComments).many()).map(([title, steps]) => ({ ...title, steps }));

const FeatureBlock = level => seq(FeatureTitle(level), alt(ScenarioOutlineBlock(level + 1), BackgroundBlock(level + 1), ScenarioBlock(level + 1), ...BlankLinesOrComments).many())
    .map(([feature, scenarios]) => ({ ...feature, scenarios }));

const GherkinParser = seq(alt(...BlankLinesOrComments, ScenarioBlock(0), FeatureBlock(0)).many(), eof).map(r => r[0]);

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
            let pointer = ' '.repeat(column - 1) + '^';
            console.error(pointer);
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
}

await parseGherkin(`small`);
await parseGherkin(`medium`);
await parseGherkin(`descriptions`);
await parseGherkin(`background`);
await parseGherkin(`parameters`);

/*
Features to test:
 - Parsing decriptions
   - Include keywords inside descriptions, full makrdown etc
   - They only stop when the intent is perfect and there's a keyword directly after - doesn't need the :
 - Comments
   - With crazy things in the comments like keywords, # symbols, :, etc
 - Blank lines
 - Breaking lines over whitespace. e.g comments
      #
        Is this a comment? Shouldn't be.
*/