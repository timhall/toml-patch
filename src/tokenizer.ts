import Cursor from './cursor';
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
  const cursor = new Cursor(input);
  const tokens: Token[] = [];
  const locate = createLocate(input);

  while (!cursor.done) {
    if (IS_WHITESPACE.test(cursor.item)) {
      // (skip whitespace)
    } else if (cursor.item === '[' || cursor.item === ']') {
      // Handle special characters: [, ], {, }, =, comma
      tokens.push(specialCharacter(cursor, locate, TokenType.Bracket));
    } else if (cursor.item === '{' || cursor.item === '}') {
      tokens.push(specialCharacter(cursor, locate, TokenType.Curly));
    } else if (cursor.item === '=') {
      tokens.push(specialCharacter(cursor, locate, TokenType.Equal));
    } else if (cursor.item === ',') {
      tokens.push(specialCharacter(cursor, locate, TokenType.Comma));
    } else if (cursor.item === '.') {
      tokens.push(specialCharacter(cursor, locate, TokenType.Dot));
    } else if (cursor.item === '#') {
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

    cursor.step();
  }

  return tokens;
}

function specialCharacter(cursor: Cursor<string>, locate: Locator, type: TokenType): Token {
  return { type, raw: cursor.item, loc: locate(cursor.index, cursor.index + 1) };
}

function comment(cursor: Cursor<string>, locate: Locator): Token {
  const start = cursor.index;
  let raw = cursor.item;
  while (!cursor.peekDone() && !IS_NEW_LINE.test(cursor.peek()!)) {
    cursor.step();
    raw += cursor.item;
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
  cursor.step(3);

  while (!cursor.done && !checkThree(cursor.items as string, cursor.index, multiline_char)) {
    raw += cursor.item;
    cursor.step();
  }

  if (cursor.done) {
    throw new ParseError(
      input,
      findPosition(input, cursor.index),
      `Expected close of multiline string with ${quotes}, reached end of file`
    );
  }

  raw += quotes;
  cursor.step(2);

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
  if (!IS_VALID_LEADING_CHARACTER.test(cursor.item)) {
    throw new ParseError(
      input,
      findPosition(input, cursor.index),
      `Unsupported character "${cursor.item}". Expected ALPHANUMERIC, ", ', +, -, or _`
    );
  }

  const start = cursor.index;
  let raw = '';
  let double_quoted = false;
  let single_quoted = false;

  while (!cursor.done) {
    if (cursor.item === DOUBLE_QUOTE) double_quoted = !double_quoted;
    if (cursor.item === SINGLE_QUOTE && !double_quoted) single_quoted = !single_quoted;

    raw += cursor.item;

    cursor.step();
    if (cursor.done) break;

    // If next character is escape and currently double-quoted,
    // check for escaped quote
    if (double_quoted && cursor.item === ESCAPE) {
      if (cursor.peek() === DOUBLE_QUOTE) {
        raw += ESCAPE + DOUBLE_QUOTE;
        cursor.step(2);
      } else if (cursor.peek() === ESCAPE) {
        raw += ESCAPE + ESCAPE;
        cursor.step(2);
      }
    }

    if (
      !(double_quoted || single_quoted) &&
      (IS_WHITESPACE.test(cursor.item) ||
        cursor.item === ',' ||
        cursor.item === '.' ||
        cursor.item === ']' ||
        cursor.item === '}' ||
        cursor.item === '=')
    ) {
      break;
    }
  }

  if (double_quoted || single_quoted) {
    throw new ParseError(
      input,
      findPosition(input, start),
      `Expected close of string with ${double_quoted ? DOUBLE_QUOTE : SINGLE_QUOTE}`
    );
  }

  // Character loop has put cursor a step ahead, step back
  cursor.step(-1);

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
