import Cursor, { iterator } from './cursor';
import { Location, Locator, createLocate, findPosition } from './location';
import ParseError from './parse-error';
import { matchAll } from './utils';

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
export interface StringToken extends Token {
  type: TokenType.String;
  parts?: string[];
}

type Dots = Map<number, number>;

interface State {
  locate: Locator;
  dots: Dots;
  input: string;
}

export const IS_WHITESPACE = /\s/;
export const IS_NEW_LINE = /(\r\n|\n)/;
export const DOUBLE_QUOTE = `"`;
export const SINGLE_QUOTE = `'`;
export const SPACE = ' ';
export const ESCAPE = '\\';
export const DOT = '.';

const IS_VALID_LEADING_CHARACTER = /[\w,\d,\",\',\+,\-,\_]/;

export function* tokenize(input: string): IterableIterator<Token> {
  const cursor = new Cursor(iterator(input));
  cursor.next();

  const locate = createLocate(input);

  // Pre-find all dots since whitespace can make it difficult to do by cursor
  const dots: Dots = new Map();
  for (const match of matchAll(input, /\s*\.\s*/g)) {
    const length = match[0].length;
    dots.set(match.index, length);
  }

  const state = { locate, dots, input };

  while (!cursor.done) {
    if (IS_WHITESPACE.test(cursor.value!)) {
      // (skip whitespace)
    } else if (cursor.value === '[' || cursor.value === ']') {
      // Handle special characters: [, ], {, }, =, comma
      yield specialCharacter(cursor, TokenType.Bracket, state);
    } else if (cursor.value === '{' || cursor.value === '}') {
      yield specialCharacter(cursor, TokenType.Curly, state);
    } else if (cursor.value === '=') {
      yield specialCharacter(cursor, TokenType.Equal, state);
    } else if (cursor.value === ',') {
      yield specialCharacter(cursor, TokenType.Comma, state);
    } else if (cursor.value === '#') {
      // Handle comments = # -> EOL
      yield comment(cursor, state);
    } else {
      const multiline_char =
        checkThree(input, cursor.index, SINGLE_QUOTE) ||
        checkThree(input, cursor.index, DOUBLE_QUOTE);

      if (multiline_char) {
        // Multi-line literals or strings = no escaping
        yield multiline(cursor, multiline_char, state);
      } else {
        yield string(cursor, state);
      }
    }

    cursor.next();
  }
}

function specialCharacter(cursor: Cursor<string>, type: TokenType, state: State): Token {
  return { type, raw: cursor.value!, loc: state.locate(cursor.index, cursor.index + 1) };
}

function comment(cursor: Cursor<string>, state: State): Token {
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
    loc: state.locate(start, cursor.index + 1)
  };
}

function multiline(cursor: Cursor<string>, multiline_char: string, state: State): Token {
  const start = cursor.index;
  let quotes = multiline_char + multiline_char + multiline_char;
  let raw = quotes;

  // Skip over quotes
  cursor.next();
  cursor.next();
  cursor.next();

  while (!cursor.done && !checkThree(state.input, cursor.index, multiline_char)) {
    raw += cursor.value;
    cursor.next();
  }

  if (cursor.done) {
    throw new ParseError(
      state.input,
      findPosition(state.input, cursor.index),
      `Expected close of multiline string with ${quotes}, reached end of file`
    );
  }

  raw += quotes;

  cursor.next();
  cursor.next();

  return {
    type: TokenType.String,
    raw,
    loc: state.locate(start, cursor.index + 1)
  };
}

function string(cursor: Cursor<string>, state: State): StringToken {
  // Remaining possibilities: keys, strings, literals, integer, float, boolean

  // First, check for invalid characters
  if (!IS_VALID_LEADING_CHARACTER.test(cursor.value!)) {
    throw new ParseError(
      state.input,
      findPosition(state.input, cursor.index),
      `Unsupported character "${cursor.value}". Expected ALPHANUMERIC, ", ', +, -, or _`
    );
  }

  const start = cursor.index;
  let raw = cursor.value!;
  let double_quoted = cursor.value === DOUBLE_QUOTE;
  let single_quoted = cursor.value === SINGLE_QUOTE;
  let dotted = 0;
  let part_range = [0, 1];
  let parts: string[] | undefined;

  const isFinished = (cursor: Cursor<string>) => {
    if (cursor.peek().done) return true;

    const next_item = cursor.peek().value!;
    const next_dotted = state.dots.has(cursor.index + 1);

    return (
      !(double_quoted || single_quoted || dotted || next_dotted) &&
      (IS_WHITESPACE.test(next_item) ||
        next_item === ',' ||
        next_item === ']' ||
        next_item === '}' ||
        next_item === '=')
    );
  };

  while (!cursor.done && !isFinished(cursor)) {
    cursor.next();

    if (cursor.value === DOUBLE_QUOTE) double_quoted = !double_quoted;
    if (cursor.value === SINGLE_QUOTE && !double_quoted) single_quoted = !single_quoted;

    if (!double_quoted && !single_quoted && state.dots.has(cursor.index)) {
      dotted = state.dots.get(cursor.index)!;
    }
    if (dotted) {
      dotted -= 1;

      if (dotted === 0) {
        if (!parts) parts = [];

        const part = raw.substring(part_range[0], part_range[1]);
        parts.push(part);

        part_range[0] = raw.length + 1;
        part_range[1] = raw.length + 1;
      }
    } else {
      part_range[1] += 1;
    }

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
      state.input,
      findPosition(state.input, start),
      `Expected close of string with ${double_quoted ? DOUBLE_QUOTE : SINGLE_QUOTE}`
    );
  }

  if (parts) {
    parts.push(raw.substring(part_range[0], part_range[1]));
  }

  return {
    type: TokenType.String,
    raw,
    loc: state.locate(start, cursor.index + 1),
    parts
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
