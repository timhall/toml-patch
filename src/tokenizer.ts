import Cursor, { iterator } from './cursor';
import { Location, Locator, createLocate, findPosition } from './location';
import ParseError from './parse-error';

export enum TokenType {
  Bracket = 'Bracket',
  Curly = 'Curly',
  Equal = 'Equal',
  Comma = 'Comma',
  Dot = 'Dot',
  Comment = 'Comment',
  String = 'String'
}

export interface Token {
  type: TokenType;
  raw: string;
  loc: Location;
}

export const IS_WHITESPACE = /\s/;
export const IS_NEW_LINE = /(\r\n|\n)/;
export const DOUBLE_QUOTE = `"`;
export const SINGLE_QUOTE = `'`;
export const SPACE = ' ';
export const ESCAPE = '\\';

const IS_VALID_LEADING_CHARACTER = /[\w,\d,\",\',\+,\-,\_]/;

export function tokenize(input: string): Token[] {
  const cursor = new Cursor(iterator(input));
  cursor.next();

  const tokens: Token[] = [];
  const locate = createLocate(input);

  while (!cursor.done) {
    if (IS_WHITESPACE.test(cursor.value!)) {
      // (skip whitespace)
    } else if (cursor.value === '[' || cursor.value === ']') {
      // Handle special characters: [, ], {, }, =, comma
      tokens.push(specialCharacter(cursor, locate, TokenType.Bracket));
    } else if (cursor.value === '{' || cursor.value === '}') {
      tokens.push(specialCharacter(cursor, locate, TokenType.Curly));
    } else if (cursor.value === '=') {
      tokens.push(specialCharacter(cursor, locate, TokenType.Equal));
    } else if (cursor.value === ',') {
      tokens.push(specialCharacter(cursor, locate, TokenType.Comma));
    } else if (cursor.value === '.') {
      tokens.push(specialCharacter(cursor, locate, TokenType.Dot));
    } else if (cursor.value === '#') {
      // Handle comments = # -> EOL
      tokens.push(comment(cursor, locate));
    } else {
      const multiline_char =
        checkThree(input, cursor.index, SINGLE_QUOTE) ||
        checkThree(input, cursor.index, DOUBLE_QUOTE);

      if (multiline_char) {
        // Multi-line literals or strings = no escaping
        tokens.push(multiline(cursor, locate, multiline_char, input));
      } else {
        tokens.push(string(cursor, locate, input));
      }
    }

    cursor.next();
  }

  return tokens;
}

function specialCharacter(cursor: Cursor<string>, locate: Locator, type: TokenType): Token {
  return { type, raw: cursor.value!, loc: locate(cursor.index, cursor.index + 1) };
}

function comment(cursor: Cursor<string>, locate: Locator): Token {
  const start = cursor.index;
  let raw = cursor.value!;
  while (!cursor.peek().done && !IS_NEW_LINE.test(cursor.peek().value!)) {
    cursor.next();
    raw += cursor.value!;
  }

  // Early exit is ok for comment, no closing conditions

  return {
    type: TokenType.Comment,
    raw,
    loc: locate(start, cursor.index + 1)
  };
}

function multiline(
  cursor: Cursor<string>,
  locate: Locator,
  multiline_char: string,
  input: string
): Token {
  const start = cursor.index;
  let quotes = multiline_char + multiline_char + multiline_char;
  let raw = quotes;

  // Skip over quotes
  cursor.next();
  cursor.next();
  cursor.next();

  while (!cursor.done && !checkThree(input, cursor.index, multiline_char)) {
    raw += cursor.value;
    cursor.next();
  }

  if (cursor.done) {
    throw new ParseError(
      input,
      findPosition(input, cursor.index),
      `Expected close of multiline string with ${quotes}, reached end of file`
    );
  }

  raw += quotes;

  cursor.next();
  cursor.next();

  return {
    type: TokenType.String,
    raw,
    loc: locate(start, cursor.index + 1)
  };
}

function string(cursor: Cursor<string>, locate: Locator, input: string): Token {
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
  if (!IS_VALID_LEADING_CHARACTER.test(cursor.value!)) {
    throw new ParseError(
      input,
      findPosition(input, cursor.index),
      `Unsupported character "${cursor.value}". Expected ALPHANUMERIC, ", ', +, -, or _`
    );
  }

  const start = cursor.index;
  let raw = cursor.value!;
  let double_quoted = cursor.value === DOUBLE_QUOTE;
  let single_quoted = cursor.value === SINGLE_QUOTE;

  const isFinished = (cursor: Cursor<string>) => {
    if (cursor.peek().done) return true;
    const next_item = cursor.peek().value!;

    return (
      !(double_quoted || single_quoted) &&
      (IS_WHITESPACE.test(next_item) ||
        next_item === ',' ||
        next_item === '.' ||
        next_item === ']' ||
        next_item === '}' ||
        next_item === '=')
    );
  };

  while (!cursor.done && !isFinished(cursor)) {
    cursor.next();

    if (cursor.value === DOUBLE_QUOTE) double_quoted = !double_quoted;
    if (cursor.value === SINGLE_QUOTE && !double_quoted) single_quoted = !single_quoted;

    raw += cursor.value!;

    if (cursor.peek().done) break;
    let next_item = cursor.peek().value!;

    // If next character is escape and currently double-quoted,
    // check for escaped quote
    if (double_quoted && cursor.value === ESCAPE) {
      if (next_item === DOUBLE_QUOTE) {
        raw += DOUBLE_QUOTE;
        cursor.next();
      } else if (next_item === ESCAPE) {
        raw += ESCAPE;
        cursor.next();
      }
    }
  }

  if (double_quoted || single_quoted) {
    throw new ParseError(
      input,
      findPosition(input, start),
      `Expected close of string with ${double_quoted ? DOUBLE_QUOTE : SINGLE_QUOTE}`
    );
  }

  return {
    type: TokenType.String,
    raw,
    loc: locate(start, cursor.index + 1)
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
