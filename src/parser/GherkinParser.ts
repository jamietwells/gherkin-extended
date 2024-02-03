"use strict";

import Parsimmon, { TypedLanguage } from 'parsimmon';
import pkg, { Parser } from 'parsimmon';
import { GherkinType, DescriptionType, StepLineTableBlockOrDocStringType, Comment, BlankLine, ScenarioOutlineBlockType } from './types.js';

const { string, newline, createLanguage, regexp, noneOf, oneOf, seq, alt, eof, of, fail, any, lookahead } = pkg;

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
  `Examples`,
  `Example`,
  `Scenario Outline`,
  `Scenario Template`,
  `Scenarios`,
  `Scenario`,
  `Background`,
  `"""`,
  `|`,
  `@`,
  `#`,
  ...stepIdentifiers
];

function not(parser: Parser<any>, description: string) {
  return Parsimmon(function (input, i) {
    if (!input.slice(i).length)
      return Parsimmon.makeFailure(i, 'not EOF');
    const parse = parser.skip(any.many()).parse(input.slice(i));
    if (!parse.status) {
      return Parsimmon.makeSuccess(i + 1, input.charAt(i));
    }
    return Parsimmon.makeFailure(i, 'anything different than "' + description + '"');
  });
}

function GherkinParserFactory(indent: number): TypedLanguage<GherkinType> {
  function chainIndented<T>(parser: (r: TypedLanguage<GherkinType>) => Parser<T>) {
    function chainIndented(n: number) {
      const indentedR = GherkinParserFactory(n);
      return parser(indentedR);
    }
    return chainIndented;
  }

  return createLanguage<GherkinType>({
    // Basic components
    NoNewLineContent: (r) => noneOf('\r\n').desc('content').many().tie(),
    Parameter: () => seq(string(`<`).desc(`open new parameter`), noneOf('>').many().tie(), string('>')).map(([_1, chars, _2]) => ({ type: 'Parameter', name: chars })),
    RegularText: () => noneOf('\r\n<').desc(`any non parameter character`).atLeast(1).tie().map((chars) => ({ type: 'Regular Text', text: chars })),
    ParameterizedLine: (r) => alt(r.Parameter, r.RegularText).many(),

    // Handling whitespace
    HorizontalWhitespaceCharacter: () => regexp(/[^\S\r\n]/).desc('horizontal whitespace'),

    // Comments and blank lines
    Comment: (r) => seq(r.HorizontalWhitespaceCharacter.many(), string('#'), r.HorizontalWhitespaceCharacter.many()).then(r.NoNewLineContent).skip(r.EndOfLineOrFile).desc('comment').map(comment => ({ type: 'Comment', comment })),
    BlankLine: (r) => r.HorizontalWhitespaceCharacter.many().then(newline).desc('blank line').map(() => ({ type: 'BlankLine' })),
    BlankLinesOrComments: (r) => alt(r.Comment, r.BlankLine).desc(`blank line/comment`),

    // The description parser - complicated, need to stop when we hit a line starting with a keyword at the correct indentation
    AnyKeyword: (r) => alt(...keywords.map(w => string(w))),
    DescriptionParser: (r) => {
      const blankLine = r.BlankLinesOrComments.map(() => '');
      const lineStop = r.IndentSame.then(lookahead(r.AnyKeyword).map<false>(() => false));
      const line = r.IndentSame.then(r.NoNewLineContent.skip(r.EndOfLineOrFile));
      const lines = (alt(blankLine, lineStop, line)).chain<string>(r => r === false ? fail(``) : of(r)).many();
      return lines.map<DescriptionType>((description) => ({ description }));
    },
    DocString: (r) => {
      const delimiter = r.IndentSame.then(string(`"""`)).desc('docstring delimiter');
      const line = r.ConsumeSameIndent.then(noneOf(`"\n`).or(string(`"`).notFollowedBy(string(`""`))).many().tie());

      return seq(delimiter.skip(newline), line.skip(newline).many().tieWith(`\n`), delimiter)
        .map(([_start, content, _end]) => ({ type: 'DocString', content } as const))
        .skip(r.EndOfLineOrFile);
    },
    // All things tags
    Tag: (r) => string(`@`).then(regexp(/[^\s@]/).desc(`valid tag characters`).many().tie()).map(r => ({ type: `Tag`, value: r })),
    Tags: (r) => r.IndentSame.then(r.Tag.sepBy1(r.HorizontalWhitespaceCharacter.atLeast(1))).skip(r.EndOfLineOrFile).map(([tag, ...tags]) => [tag, ...tags]),
    TagsOptional: (r) => r.Tags.atMost(1).map(t => t.flat()),

    // Table parsing
    EmptyCell: (r) => string(`|`).then(r.HorizontalWhitespaceCharacter.many()).lookahead(string(`|`)).map(() => ``),
    FilledCell: (r) => string(`|`).then(r.HorizontalWhitespaceCharacter.many()).then(alt(string(`\\\\`).map(() => `\\`), alt(string(`\\|`).map(() => `|`), not(r.HorizontalWhitespaceCharacter.many().then(string(`|`).or(r.NewLine)), `end of cell`))).atLeast(1).tie()).skip(r.HorizontalWhitespaceCharacter.many()),
    CellContent: (r) => alt(r.EmptyCell, r.FilledCell),
    TableLine: (r) => r.CellContent.many().skip(string(`|`)),
    SingleTableRow: (r) => r.TableLine.skip(r.EndOfLineOrFile).map(cells => ({ type: "TableRow", cells })),
    Table: (r) => r.IndentSame.then(r.SingleTableRow).atLeast(2).map(rows => ({ type: 'Table', rows })),

    StepLineTableBlockOrDocString: (r) => alt(...stepIdentifiers.map(word => r.IndentSame.then(string(word)).then(r.HorizontalWhitespaceCharacter.many()).then(r.ParameterizedLine).skip(r.EndOfLineOrFile).desc(`${word} step`).map((text) => ({ type: `Step`, word, text }))), r.IndentMoreLookahead.chain(chainIndented(ri => ri.Table.or(ri.DocString)))),

    ScenarioOutlineTitle: (r) => r.IndentSame.then(string(`Scenario Outline`)).then(string(':')).then(r.HorizontalWhitespaceCharacter.many()).then(r.NoNewLineContent).map(title => ({ type: `ScenarioOutline`, title })),
    BackgroundTitle: (r) => r.IndentSame.then(string(`Background`)).then(string(':')).then(r.HorizontalWhitespaceCharacter.many()).then(r.NoNewLineContent).map(title => ({ type: `Background`, title })),
    ScenarioTitle: (r) => r.IndentSame.then(string(`Scenario`)).then(string(':')).then(r.HorizontalWhitespaceCharacter.many()).then(r.NoNewLineContent).map(title => ({ type: `Scenario`, title })),
    FeatureTitle: (r) => r.IndentSame.then(string(`Feature`)).then(string(':')).then(r.HorizontalWhitespaceCharacter.many()).then(r.NoNewLineContent).map(title => ({ type: `Feature`, title })),
    RuleTitle: (r) => r.IndentSame.then(string(`Rule`)).then(string(':')).then(r.HorizontalWhitespaceCharacter.many()).then(r.NoNewLineContent).map(title => ({ type: `Rule`, title })),
    ExampleTitle: (r) => r.IndentSame.then(string(`Example`)).then(string(':')).then(r.HorizontalWhitespaceCharacter.many()).then(r.NoNewLineContent).map(title => ({ type: `Example`, title })),
    ExamplesTitle: (r) => r.IndentSame.then(string(`Examples`)).then(string(':')).then(r.HorizontalWhitespaceCharacter.many()).map(() => ({ type: `Examples` })),

    ExamplesBlock: (r) => seq(r.ExamplesTitle.skip(r.EndOfLineOrFile).skip(r.BlankLinesOrComments.many()), r.IndentMoreLookahead.chain(chainIndented(ri => ri.Table))).map(([title, table]) => ({ ...title, table: table })),
    BackgroundBlock: (r) => seq(r.BackgroundTitle.skip(r.EndOfLineOrFile).skip(r.BlankLinesOrComments.many()), r.IndentMoreLookahead.chain(chainIndented(ri => alt(ri.StepLineTableBlockOrDocString, r.BlankLinesOrComments).many()))).map(([title, steps]) => ({ ...title, steps })),

    ScenarioOutlineBlock: (r) => {
      const tagsParser = r.TagsOptional;
      const titleParser = r.ScenarioOutlineTitle.skip(r.EndOfLineOrFile).skip(r.BlankLinesOrComments.many());
      const stepsParser = r.IndentMoreLookahead.chain(chainIndented(ri => {
        const stepsParser = alt<StepLineTableBlockOrDocStringType | Comment | BlankLine>(ri.StepLineTableBlockOrDocString, ri.BlankLinesOrComments).many();
        const exampleBlockParser = ri.ExamplesBlock.atMost(1);
        const blankLineParser = ri.BlankLinesOrComments.many();
        return seq(stepsParser, exampleBlockParser, blankLineParser);
      }));
      const par = seq(tagsParser, titleParser, stepsParser)
      
      return par.map(result => {
        const [tags, title, [steps, example, trailingBlankLines] ] = result;
        const examples = [...example, ...trailingBlankLines];
        return { tags, ...title, steps, examples } as ScenarioOutlineBlockType;
      })
    },
    FeatureBlock: (r) => seq(r.TagsOptional, r.FeatureTitle.skip(r.EndOfLineOrFile).skip(r.BlankLinesOrComments.many()), r.IndentMoreLookahead.chain(chainIndented(ri => seq(ri.DescriptionParser, alt(ri.ScenarioBlock, ri.ScenarioOutlineBlock, ri.BackgroundBlock, ri.RuleBlock).many())))).map(([tags, feature, [description, scenarios]]) => ({ ...feature, tags, ...description, scenarios })),
    RuleBlock: (r) => seq(r.TagsOptional, r.RuleTitle.skip(r.EndOfLineOrFile).skip(r.BlankLinesOrComments.many()), r.IndentMoreLookahead.chain(chainIndented(ri => ri.ExampleBlock.many()))).map(([tags, title, examples]) => ({ ...title, tags, examples })),
    ExampleBlock: (r) => seq(r.TagsOptional, r.ExampleTitle.skip(r.EndOfLineOrFile).skip(r.BlankLinesOrComments.many()), r.IndentMoreLookahead.chain(chainIndented(ri => alt(ri.StepLineTableBlockOrDocString, r.BlankLinesOrComments).many()))).map(([tags, title, steps]) => ({ ...title, tags, steps })),
    ScenarioBlock: (r) => seq(r.TagsOptional, r.ScenarioTitle.skip(r.EndOfLineOrFile).skip(r.BlankLinesOrComments.many()), r.IndentMoreLookahead.chain(chainIndented(ri => alt(ri.StepLineTableBlockOrDocString, r.BlankLinesOrComments).many()))).map(([tags, title, steps]) => ({ ...title, tags, steps })),

    GherkinFile: (r) => alt(r.BlankLinesOrComments, r.ScenarioOutlineBlock, r.ScenarioBlock, r.FeatureBlock).many(),
    IndentSame: (r) => regexp(/[ ]*/).map(s => s.length).chain(n => {
      if (n === indent) {
        return of(n);
      }
      return fail(`${indent} spaces (found ${n})`);
    }),
    ConsumeSameIndent: (r) => string(` `).times(indent).tie(),
    IndentMoreLookahead: () => {
      const x = regexp(/[ ]*/).map(s => s.length);
      return Parsimmon<number>(function (input, i) {
        var result = (x as any)._(input, i);
        result.index = i;
        return result;
      }).chain(n => {
        if (n > indent) {
          return of(n);
        }
        return fail(`more than ${indent} spaces (found ${n})`);
      });
    },
    NewLine: () => alt(string("\r\n"), oneOf("\r\n")).desc(`newline`).map(() => null),
    EndOfLineOrFile: (r) => alt(r.NewLine, eof).map(() => null)
  });
}

export const gherkinParser = GherkinParserFactory(0);