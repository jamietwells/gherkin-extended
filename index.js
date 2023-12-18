import { readFile } from 'fs/promises';
import pkg from 'parsimmon';
const { string, newline, whitespace, regexp, seq, alt, eof } = pkg;

const RestOfLine = seq(regexp('[^\r\n]').desc('content').many().map(chars => chars.join('')), newline.or(eof)).map(r => r[0]);

// Parser for a single line comment
const Comment = seq(string('#'), whitespace.many(), RestOfLine).desc('comment').map((r) => ({ type: 'Comment', comment: r[2] }));

// Parser for a blank line
const BlankLine = seq(regexp(/[^\S\r\n]/).many(), newline).desc('blank line').map(_ => ({ type: 'BlankLine' }));

const FeatureKeyword = string('Feature');

const FeatureBlock = seq(FeatureKeyword, string(':'), whitespace.many(), RestOfLine, )

// Parser for optional comments or blank lines
const OptionalCommentsOrBlankLines = alt(Comment, BlankLine);

const GherkinParser = seq(OptionalCommentsOrBlankLines.many(), eof).map(r => r[0]);

// Function to parse a Gherkin file
function parseGherkin(text) {
    const result = GherkinParser.parse(text);
    if (result.status) {
        console.log('Parsed Gherkin:', result.value);
    } else {
        console.error('Parsing error:', result);
    }
}

const example = await readFile('./small.feature', { encoding: 'utf8' });

parseGherkin(example);
