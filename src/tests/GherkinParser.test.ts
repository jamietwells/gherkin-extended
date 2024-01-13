import { expect } from 'chai';
import { gherkinParser } from '../parser/GherkinParser.js';
import fs from 'node:fs/promises';
import pkg, { Failure, Parser, Result } from 'parsimmon';
import * as chai from 'chai';
const { string, newline, seq } = pkg;

chai.config.truncateThreshold = 0; // disable truncating

describe('Gherkin Parser', () => {
  const setupTest = <T>(parser: Parser<T>, description: (input: string) => string) => {
    const result = {
      runTest: (input: string, expected: T, ...parsers: Parser<unknown>[]) => {
        it(description(input), () => {
          const result = parser.skip(seq(...parsers)).tryParse(input);
          expect(result).deep.equal(expected);
        });
        return result;
      },
      failParse: (input: string, expectedLine: number, expectedColumn: number, ...expected: string[]) => {
        it(description(input), () => {
          const result = parser.parse(input) as Failure;
          expect(result.status).false;
          const { line, column } = result.index;
          expect(line).to.equal(expectedLine);
          expect(column).to.equal(expectedColumn);
          expect(result.expected).to.have.same.members(expected);
        });
        return result;
      }
    };
    return result;
  };

  setupTest(gherkinParser.Comment, input => `should parse comment: ${JSON.stringify(input)}`)
    .runTest('# This is a comment', { type: 'Comment', comment: 'This is a comment' })
    .runTest('# This is a comment', { type: 'Comment', comment: 'This is a comment' })
    .runTest('# Another comment', { type: 'Comment', comment: 'Another comment' })
    .runTest('  # Preceding whitespace', { type: 'Comment', comment: 'Preceding whitespace' })
    .runTest('#  Trailing whitespace', { type: 'Comment', comment: 'Trailing whitespace' })
    .runTest('#No whitespace', { type: 'Comment', comment: 'No whitespace' });

  setupTest(gherkinParser.BlankLine, input => `should parse blank line: ${JSON.stringify(input)}`)
    .runTest('\n', { type: 'BlankLine' })
    .runTest('    \n', { type: 'BlankLine' })
    .runTest('\t\n', { type: 'BlankLine' })
    .runTest('  \t  \n', { type: 'BlankLine' })
    .runTest('\r\n', { type: 'BlankLine' })
    .runTest(' \r\n', { type: 'BlankLine' });

  setupTest(gherkinParser.FeatureTitle, input => `should parse feature title: ${JSON.stringify(input)}`)
    .runTest('Feature: User management', { type: 'Feature', title: 'User management' })
    .runTest('Feature:   User login functionality', { type: 'Feature', title: 'User login functionality' })
    .runTest('Feature:\tPayment processing', { type: 'Feature', title: 'Payment processing' });

  setupTest(gherkinParser.ScenarioTitle, input => `should parse scenario title: ${JSON.stringify(input)}`)
    .runTest('Scenario: Admin creates a new user account', { type: 'Scenario', title: 'Admin creates a new user account' })
    .runTest('Scenario:   User logs in successfully', { type: 'Scenario', title: 'User logs in successfully' })
    .runTest('Scenario:\tUser processes a payment', { type: 'Scenario', title: 'User processes a payment' });

  setupTest(gherkinParser.NoNewLineContent, input => `should parse NoNewLineContent: ${JSON.stringify(input)}`)
    .runTest(`ABC`, `ABC`)
    .runTest(`A B C`, `A B C`);

  setupTest(gherkinParser.Parameter, input => `should parse Parameter: ${JSON.stringify(input)}`)
    .runTest(`<abc>`, { type: `Parameter`, name: `abc` });

  setupTest(gherkinParser.RegularText, input => `should parse RegularText: ${JSON.stringify(input)}`)
    .runTest(`Regular text here`, { type: 'Regular Text', text: 'Regular text here' });

  setupTest(gherkinParser.ParameterizedLine, input => `should parse ParameterizedLine: ${JSON.stringify(input)}`)
    .runTest(`Text with <parameter>`, [{ type: 'Regular Text', text: `Text with ` }, { type: 'Parameter', name: `parameter` }]);

  setupTest(gherkinParser.SingleTableRow, input => `should parse SingleTableRow: ${JSON.stringify(input)}`)
    .runTest(`| cell1 | cell2 |`, { type: 'TableRow', cells: ['cell1', 'cell2'] });

  setupTest(gherkinParser.HorizontalWhitespaceCharacter, input => `should parse any horizontal whitespace character: ${JSON.stringify(input)}`)
    .runTest(` `, ' ')
    .runTest(`\t`, '\t');

  setupTest(gherkinParser.Comment, input => `should parse Comment: ${JSON.stringify(input)}`)
    .runTest(`# This is a comment`, { type: 'Comment', comment: 'This is a comment' });

  setupTest(gherkinParser.BlankLine, input => `should parse BlankLine: ${JSON.stringify(input)}`)
    .runTest(`\n`, { type: 'BlankLine' });

  setupTest(gherkinParser.BlankLinesOrComments, input => `should parse BlankLinesOrComments: ${JSON.stringify(input)}`)
    .runTest(`# Comment`, { type: 'Comment', comment: 'Comment' });

  setupTest(gherkinParser.AnyKeyword, input => `should parse keyword: ${JSON.stringify(input)}`)
    .runTest(`Given`, `Given`)
    .runTest(`When`, `When`)
    .runTest(`Then`, `Then`)
    .runTest(`And`, `And`)
    .runTest(`But`, `But`)
    .runTest(`*`, `*`)
    .runTest(`Feature`, `Feature`)
    .runTest(`Rule`, `Rule`)
    .runTest(`Example`, `Example`)
    .runTest(`Scenario`, `Scenario`)
    .runTest(`Background`, `Background`)
    .runTest(`Scenario Outline`, `Scenario Outline`)
    .runTest(`Scenario Template`, `Scenario Template`)
    .runTest(`Examples`, `Examples`)
    .runTest(`Scenarios`, `Scenarios`)
    .runTest(`"""`, `"""`)
    .runTest(`|`, `|`)
    .runTest(`@`, `@`)
    .runTest(`#`, `#`);

  setupTest(gherkinParser.Tag, input => `should parse Tag: ${JSON.stringify(input)}`)
    .runTest(`@tag1`, { type: 'Tag', value: 'tag1' });

  setupTest(gherkinParser.Tags, input => `should parse Tags: ${JSON.stringify(input)}`)
    .runTest(`@tag1 @tag2`, [{ type: 'Tag', value: 'tag1' }, { type: 'Tag', value: 'tag2' }])
    .runTest(`@tag1 \t  @tag2`, [{ type: 'Tag', value: 'tag1' }, { type: 'Tag', value: 'tag2' }])
    .failParse(`@tag1@`, 1, 6, 'EOF', 'horizontal whitespace', 'newline', 'valid tag characters');

  setupTest(gherkinParser.CellContent, input => `should parse CellContent: ${JSON.stringify(input)}`)
    .runTest(String.raw`| cell content |`, 'cell content', string(`|`))
    .runTest(String.raw`| \| |`, `|`, string(`|`))
    .runTest(String.raw`| \\\| |`, `\\\|`, string(`|`))
    .runTest(String.raw`|\\|`, `\\`, string(`|`))
    .runTest(String.raw`|\|\\|`, `\|\\`, string(`|`));

  setupTest(gherkinParser.TableLine, input => `should parse TableLine: ${JSON.stringify(input)}`)
    .runTest(`| cell1 | cell2 |`, ['cell1', 'cell2']);

  setupTest(gherkinParser.Table, input => `should parse Table: ${JSON.stringify(input)}`)
    .runTest(`| header1 | header2 |\n| data1 | data2 |`, { type: 'Table', rows: [{ type: `TableRow`, cells: ['header1', 'header2'] }, { type: `TableRow`, cells: ['data1', 'data2'] }] });

  setupTest(gherkinParser.StepLineOrTableBlock, input => `should parse StepLineOrTableBlock: ${JSON.stringify(input)}`)
    .runTest(`Given some step`, { type: 'Step', word: 'Given', text: [{ type: `Regular Text`, text: 'some step' }] });

  setupTest(gherkinParser.ScenarioOutlineTitle, input => `should parse ScenarioOutlineTitle: ${JSON.stringify(input)}`)
    .runTest(`Scenario Outline: An outline`, { type: 'ScenarioOutline', title: 'An outline' });

  setupTest(gherkinParser.BackgroundTitle, input => `should parse BackgroundTitle: ${JSON.stringify(input)}`)
    .runTest(`Background: Some background`, { type: 'Background', title: 'Some background' });

  setupTest(gherkinParser.ScenarioTitle, input => `should parse ScenarioTitle: ${JSON.stringify(input)}`)
    .runTest(`Scenario: A scenario`, { type: 'Scenario', title: 'A scenario' });

  setupTest(gherkinParser.FeatureTitle, input => `should parse FeatureTitle: ${JSON.stringify(input)}`)
    .runTest(`Feature: A feature`, { type: 'Feature', title: 'A feature' });

  setupTest(gherkinParser.RuleTitle, input => `should parse RuleTitle: ${JSON.stringify(input)}`)
    .runTest(`Rule: A rule`, { type: 'Rule', title: 'A rule' });

  setupTest(gherkinParser.ExampleTitle, input => `should parse ExampleTitle: ${JSON.stringify(input)}`)
    .runTest(`Example: An example`, { type: 'Example', title: 'An example' });

  setupTest(gherkinParser.ExamplesTitle, input => `should parse ExamplesTitle: ${JSON.stringify(input)}`)
    .runTest(`Examples:`, { type: 'Examples' });

  setupTest(gherkinParser.BackgroundBlock, input => `should parse BackgroundBlock: ${JSON.stringify(input)}`)
    .runTest(`Background: Some background\n  Given some context`, { type: 'Background', title: 'Some background', steps: [{ type: 'Step', word: 'Given', text: [{ type: `Regular Text`, text: 'some context' }] }] });

  setupTest(gherkinParser.RuleBlock, input => `should parse RuleBlock: ${JSON.stringify(input)}`)
    .runTest(`Rule: A rule\n  Example: An example\n    Given some step`, { type: 'Rule', title: 'A rule', tags: [], examples: [{ tags: [], type: 'Example', title: 'An example', steps: [{ type: 'Step', word: 'Given', text: [{ type: `Regular Text`, text: 'some step' }] }] }] });

  setupTest(gherkinParser.ExamplesBlock, input => `should parse ExamplesBlock: ${JSON.stringify(input)}`)
    .runTest(`Examples:\n  | header1 |\n  | data1 |`, { type: 'Examples', table: { type: 'Table', rows: [{ type: `TableRow`, cells: ['header1'] }, { type: `TableRow`, cells: ['data1'] }] } });

  setupTest(gherkinParser.ExampleBlock, input => `should parse ExampleBlock: ${JSON.stringify(input)}`)
    .runTest(`Example: An example\n  Given some step`, { type: 'Example', tags: [], title: 'An example', steps: [{ type: 'Step', word: 'Given', text: [{ type: `Regular Text`, text: 'some step' }] }] });

  setupTest(gherkinParser.ScenarioOutlineBlock, input => `should parse ScenarioOutlineBlock: ${JSON.stringify(input)}`)
    .runTest(`Scenario Outline: An outline\n  Given <something>`, { type: 'ScenarioOutline', title: 'An outline', steps: [{ type: 'Step', word: 'Given', text: [{ type: `Parameter`, name: 'something' }] }], examples: [] });

  setupTest(gherkinParser.FeatureBlock, input => `should parse FeatureBlock: ${JSON.stringify(input)}`)
    .runTest(`Feature: A feature\n  Scenario: A scenario\n    Given some step`, { type: 'Feature', title: 'A feature', tags: [], description: [], scenarios: [{ tags: [], type: 'Scenario', title: 'A scenario', steps: [{ type: 'Step', word: 'Given', text: [{ type: `Regular Text`, text: 'some step' }] }] }] });

  setupTest(gherkinParser.ScenarioBlock, input => `should parse Scenario Block: ${JSON.stringify(input)}`)
    .runTest(`Scenario: A scenario\n  Given some step`, { type: 'Scenario', title: 'A scenario', tags: [], steps: [{ type: 'Step', word: 'Given', text: [{ type: `Regular Text`, text: 'some step' }] }] })
    .runTest(`Scenario: A scenario\n  Given some step\n  When other step`, { type: 'Scenario', title: 'A scenario', tags: [], steps: [{ type: 'Step', word: 'Given', text: [{ type: `Regular Text`, text: 'some step' }] }, { type: 'Step', word: 'When', text: [{ type: `Regular Text`, text: 'other step' }] }] });

  setupTest(gherkinParser.GherkinFile, input => `should parse GherkinFile: ${JSON.stringify(input)}`)
    .runTest(`Feature: A feature\n  Scenario: A scenario\n    Given some step`, [{ type: 'Feature', title: 'A feature', tags: [], description: [], scenarios: [{ tags: [], type: 'Scenario', title: 'A scenario', steps: [{ type: 'Step', word: 'Given', text: [{ type: `Regular Text`, text: 'some step' }] }] }] }]);

  setupTest(gherkinParser.IndentSame, input => `should parse IndentSame: ${JSON.stringify(input)}`)
    .runTest(``, 0);

  setupTest(gherkinParser.IndentMoreLookahead, input => `should parse IndentMore: ${JSON.stringify(input)}`)
    .runTest(` `, 1, string(` `))
    .runTest(`  `, 2, string(`  `))
    .runTest(`   `, 3, string(`   `));

  setupTest(gherkinParser.DescriptionParser.skip(gherkinParser.AnyKeyword), input => `should parse DescriptionParser: ${JSON.stringify(input)}`)
    .runTest(`This is a description\nFeature`, { description: ['This is a description'] })
    .runTest(`This is a\nmulti-line description\n\nFeature`, { description: ['This is a', 'multi-line description', ''] })
    .runTest(`This is a\ndescription with keywords\nlike Feature in it\nGiven`, { description: ['This is a', 'description with keywords', 'like Feature in it'] });
});

describe(`Full file tests`, () => {
  for (const file of [`tiny`, `small`, `medium`, `descriptions`, `background`, `parameters`, `tags`, `full`]) {
    it(`Testing ${file} parses correctly`, async () => {
      const text = await fs.readFile(`./src/tests/examples/${file}.feature`, { encoding: 'utf8' });
      const result = gherkinParser.GherkinFile.tryParse(text);
      const expected = JSON.parse(await fs.readFile(`./src/tests/examples/${file}.json`, { encoding: 'utf8' }));
      expect(result).deep.equal(expected);
    });
  }
})








