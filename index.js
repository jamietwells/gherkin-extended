import { readFile } from 'fs/promises';
import pkg from 'parsimmon';
const { string, newline, whitespace, regexp, seq, alt, eof } = pkg;

const RestOfLine = seq(regexp(/[^\r\n]/).desc('content').many().map(chars => chars.join('')), newline.or(eof)).map(r => r[0]);

const Comment = seq(whitespace.many(), string('#'), whitespace.many(), RestOfLine).desc('comment').map((r) => ({ type: 'Comment', comment: r[3] }));

const BlankLine = seq(regexp(/[^\S\r\n]/).many(), newline).desc('blank line').map(_ => ({ type: 'BlankLine' }));

const Step = level => word => seq(string('  ').times(level), string(word), whitespace.many(), RestOfLine).map(([_1, _2, _3, title]) => ({ type: `Step`, word, title }));

const AnyStep = level => alt(...[`Given`, `When`, `Then`, `And`, `But`, `*`].map(Step(level)));

const TitleLine = name => level => seq(string('  ').times(level), string(name), string(':'), whitespace.many(), RestOfLine)
    .map(([_1, _2, _3, _4, title]) => ({ type: name, title }));

const [ScenarioTitle, FeatureTitle] = [`Scenario`, `Feature`].map(TitleLine);

const BlankLinesOrComments = [ Comment, BlankLine ];

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
