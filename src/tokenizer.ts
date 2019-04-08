import Cursor from './cursor';

// TODO
// - [ ] Whitespace around the key is ignored
//       -> Likely need to move dots from String and into separate token

export enum TokenType {
  Bracket = 'Bracket',
  Curly = 'Curly',
  Equal = 'Equal',
  Comma = 'Comma',
  Comment = 'Comment',
  String = 'String'
}

export interface Token {
  type: TokenType;
  raw: string;
  loc: Location;
}

export interface Location {
  start: Position;
  end: Position;
}

export interface Position {
  // Note: line is 1-indexed while column is 0-indexed
  line: number;
  column: number;
}

type Locator = (start: number, end: number) => Location;

export const IS_WHITESPACE = /\s/;
export const IS_NEW_LINE = /(\r\n|\n)/;
export const DOUBLE_QUOTE = `"`;
export const SINGLE_QUOTE = `'`;
export const SPACE = ' ';
export const ESCAPE = '\\';
export const IS_FULL_DATE = /(\d{4})-(\d{2})-(\d{2})/;
export const IS_FULL_TIME = /(\d{2}):(\d{2}):(\d{2})/;

const IS_VALID_LEADING_CHARACTER = /[\w,\d,\",\',\+,\-,\_]/;

export function tokenize(input: string): Token[] {
  const cursor = new Cursor(input);
  const tokens: Token[] = [];

  const lines = findLines(input);
  const location: Locator = (start: number, end: number) => {
    return {
      start: findPosition(lines, start),
      end: findPosition(lines, end)
    };
  };

  while (!cursor.done) {
    if (IS_WHITESPACE.test(cursor.item!)) {
      cursor.step();
      continue;
    }

    // Handle special characters: [, ], {, }, =, comma
    if (cursor.item! === '[' || cursor.item! === ']') {
      tokens.push(specialCharacter(cursor, location, TokenType.Bracket));
    } else if (cursor.item! === '{' || cursor.item! === '}') {
      tokens.push(specialCharacter(cursor, location, TokenType.Curly));
    } else if (cursor.item! === '=') {
      tokens.push(specialCharacter(cursor, location, TokenType.Equal));
    } else if (cursor.item! === ',') {
      tokens.push(specialCharacter(cursor, location, TokenType.Comma));
    } else if (cursor.item! === '#') {
      // Handle comments = # -> EOL
      tokens.push(comment(cursor, location));
    } else {
      const multiline_char =
        checkThree(input, cursor.index, SINGLE_QUOTE) ||
        checkThree(input, cursor.index, DOUBLE_QUOTE);

      if (multiline_char) {
        // Multi-line literals or strings = no escaping
        tokens.push(multiline(cursor, location, multiline_char));
      } else {
        tokens.push(string(cursor, location));
      }
    }

    cursor.step();
  }

  return tokens;
}

function specialCharacter(cursor: Cursor<string>, location: Locator, type: TokenType): Token {
  return { type, raw: cursor.item!, loc: location(cursor.index, cursor.index + 1) };
}

function comment(cursor: Cursor<string>, location: Locator): Token {
  const start = cursor.index;
  let raw = cursor.item!;
  while (!cursor.peekDone() && !IS_NEW_LINE.test(cursor.peek()!)) {
    cursor.step();
    raw += cursor.item!;
  }

  return {
    type: TokenType.Comment,
    raw,
    loc: location(start, cursor.index + 1)
  };
}

function multiline(cursor: Cursor<string>, location: Locator, multiline_char: string): Token {
  const start = cursor.index;
  let raw = multiline_char + multiline_char + multiline_char;
  cursor.step(3);

  while (!cursor.done && !checkThree(cursor.items as string, cursor.index, multiline_char)) {
    raw += cursor.item!;
    cursor.step();
  }

  raw += multiline_char + multiline_char + multiline_char;
  cursor.step(2);

  return {
    type: TokenType.String,
    raw,
    loc: location(start, cursor.index + 1)
  };
}

function string(cursor: Cursor<string>, location: Locator): Token {
  // Remaining possibilities: keys, strings, literals, integer, float, boolean
  //
  // Special cases:
  // "..." -> quoted
  // '...' -> quoted
  // "...".'...' -> bare
  // 0000-00-00 00:00:00 -> bare
  //
  // See https://github.com/toml-lang/toml#offset-date-time
  //
  // | For the sake of readability, you may replace the T delimiter between date and time with a space (as permitted by RFC 3339 section 5.6).
  // | `odt4 = 1979-05-27 07:32:00Z`
  //
  // From RFC 3339:
  //
  // | NOTE: ISO 8601 defines date and time separated by "T".
  // | Applications using this syntax may choose, for the sake of
  // | readability, to specify a full-date and full-time separated by
  // | (say) a space character.

  // First, check for invalid characters
  if (!IS_VALID_LEADING_CHARACTER.test(cursor.item!)) {
    throw new Error(`Unsupported character "${cursor.item!}" found at ${cursor.index}`);
  }

  const start = cursor.index;
  let raw = '';
  let double_quoted = false;
  let single_quoted = false;

  while (!cursor.done) {
    if (cursor.item! === DOUBLE_QUOTE) double_quoted = !double_quoted;
    if (cursor.item! === SINGLE_QUOTE) single_quoted = !single_quoted;

    raw += cursor.item!;
    cursor.step();

    // If next character is escape and currently double-quoted,
    // check for escaped quote
    if (double_quoted && cursor.item! === ESCAPE) {
      if (cursor.peek() === DOUBLE_QUOTE) {
        raw += ESCAPE + DOUBLE_QUOTE;
        cursor.step(2);
      }
    }

    // If next character is IS_WHITESPACE,
    // check if raw is full date and following is full time
    if (cursor.item! === SPACE && IS_FULL_DATE.test(raw)) {
      const possibly_time = (cursor.items as string).substr(cursor.index + 1, 8);
      if (IS_FULL_TIME.test(possibly_time)) {
        raw += SPACE;
        cursor.step();
      }
    }

    if (
      !(double_quoted || single_quoted) &&
      (IS_WHITESPACE.test(cursor.item!) || cursor.item! === ',' || cursor.item! === ']')
    ) {
      break;
    }
  }

  if (double_quoted) {
    throw new Error(`Un-closed string found starting at ${start} (${raw})`);
  }
  if (single_quoted) {
    throw new Error(`Un-closed string literal found starting at ${start} (${raw})`);
  }

  // Character loop has put cursor a step ahead, step back
  cursor.index -= 1;

  return {
    type: TokenType.String,
    raw,
    loc: location(start, cursor.index + 1)
  };
}

function checkThree(input: string, current: number, check: string): false | string {
  return (
    input[current] === check &&
    input[current + 1] === check &&
    input[current + 2] === check &&
    check
  );
}

export function findLines(input: string): number[] {
  // exec is stateful, so create new regexp each time
  const BY_NEW_LINE = /[\r\n|\n]/g;
  const indexes: number[] = [];

  let match;
  while ((match = BY_NEW_LINE.exec(input)) != null) {
    indexes.push(match.index);
  }

  return indexes.concat([input.length + 1]);
}

// abc\ndef\ng
// 0123 4567 8
//      012
//           0
//
// lines = [3, 7, 9]
//
// c = 2: 0 -> 1, 2 - (undefined + 1 || 0) = 2
//     3: 0 -> 1, 3 - (undefined + 1 || 0) = 3
// e = 5: 1 -> 2, 5 - (3 + 1 || 0) = 1
// g = 8: 2 -> 3, 8 - (7 + 1 || 0) = 0

export function findPosition(lines: number[], index: number): Position {
  const line = lines.findIndex(line_index => line_index >= index) + 1;
  const column = index - (lines[line - 2] + 1 || 0);

  return { line, column };
}
