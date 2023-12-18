import { readFile } from 'fs/promises';
import pkg from 'parsimmon';
const { string, newline, whitespace, regexp, seq, alt, eof } = pkg;

const RestOfLine = seq(regexp(/[^\r\n]/).desc('content').many().map(chars => chars.join('')), newline.or(eof)).map(r => r[0]);

// Parser for a single line comment
const Comment = seq(string('#'), whitespace.many(), RestOfLine).desc('comment').map((r) => ({ type: 'Comment', comment: r[2] }));

// Parser for a blank line
const BlankLine = seq(regexp(/[^\S\r\n]/).many(), newline).desc('blank line').map(_ => ({ type: 'BlankLine' }));

const Step = word => seq(string('  '), string(word), whitespace.many(), RestOfLine).map(([_1, _2, _3, title]) => ({ type: `Step`, word, title }));

const AnyStep = alt(...[`Given`, `When`, `Then`, `And`, `But`, `*`].map(Step));

const ScenarioTitle = seq(string('Scenario'), string(':'), whitespace.many(), RestOfLine)
    .map(([_1, _2, _3, title]) => ({ type: 'Scenario', title }));

const ScenarioBlock = seq(ScenarioTitle, AnyStep.many()).map(([title, steps]) => ({ ...title, steps }));

const GherkinParser = seq(alt(Comment, BlankLine, ScenarioBlock).many(), eof).map(r => r[0]);

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
//await parseGherkin(`medium`);
