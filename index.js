import { readFile } from 'fs/promises';
import pkg from 'parsimmon';
const { string, newline, whitespace, regexp, seq, alt, eof } = pkg;

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

const RestOfLine = seq(regexp(/[^\r\n]/).desc('content').many().map(chars => chars.join('')), newline.or(eof)).map(r => r[0]);

const Comment = seq(whitespace.many(), string('#'), whitespace.many(), RestOfLine).desc('comment').map((r) => ({ type: 'Comment', comment: r[3] }));

const BlankLine = seq(regexp(/[^\S\r\n]/).many(), newline).desc('blank line').map(_ => ({ type: 'BlankLine' }));

const Indentation = level => string('  ').desc('indentation').times(level);

const Step = level => word => seq(Indentation(level), string(word), whitespace.many(), RestOfLine).map(([_1, _2, _3, title]) => ({ type: `Step`, word, title }));

const AnyStep = level => alt(...stepIdentifiers.map(Step(level)));

const DescriptionStop = alt(...keywords.map(w => string(w)));

const DescriptionParser = level => seq(Indentation(level + 1).notFollowedBy(DescriptionStop), RestOfLine).many().map(r => r.map(l => l[1]).join("\n"))

const TitleLine = name => level => seq(Indentation(level), string(name), string(':'), whitespace.many(), RestOfLine, DescriptionParser(level))
    .map(([_1, _2, _3, _4, title, description]) => ({ type: name, title, description }));

const [ScenarioTitle, FeatureTitle] = [`Scenario`, `Feature`].map(TitleLine);

const BlankLinesOrComments = [Comment, BlankLine];

const ScenarioBlock = level => seq(ScenarioTitle(level), alt(AnyStep(level + 1), ...BlankLinesOrComments).many()).map(([title, steps]) => ({ ...title, steps }));

const FeatureBlock = level => seq(FeatureTitle(level), alt(ScenarioBlock(level + 1), ...BlankLinesOrComments).many())
    .map(([feature, scenarios]) => ({ ...feature, scenarios }));

const GherkinParser = seq(alt(...BlankLinesOrComments, ScenarioBlock(0), FeatureBlock(0)).many(), eof).map(r => r[0]);

// Function to parse a Gherkin file
async function parseGherkin(name) {
    console.log(`Output of ${name}`);
    const text = await readFile(`./examples/${name}.feature`, { encoding: 'utf8' });
    const result = GherkinParser.parse(text);
    if (result.status) {
        console.log('Parsed Gherkin:', JSON.stringify(result.value, null, 2));
    } else {
        console.error('Parsing error:', result);
    }
}

await parseGherkin(`small`);
await parseGherkin(`medium`);
await parseGherkin(`descriptions`);
await parseGherkin(`full`);
