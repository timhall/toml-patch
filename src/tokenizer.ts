export enum TokenType {
  Bracket = 'Bracket',
  Curly = 'Curly',
  Equal = 'Equal',
  Comma = 'Comma',
  Comment = 'Comment',
  String = 'String'
}

export interface Token {
  token_type: TokenType;
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

const IS_WHITESPACE = /\s/;
const IS_NEW_LINE = /(\r\n|\n)/;
const IS_VALID_LEADING_CHARACTER = /[\w,\d,\",\',\+,\-,\_]/;
const DOUBLE_QUOTE = `"`;
const SINGLE_QUOTE = `'`;
const SPACE = ' ';
const ESCAPE = '\\';
const IS_FULL_DATE = /(\d{4})-(\d{2})-(\d{2})/;
const IS_FULL_TIME = /(\d{2}):(\d{2}):(\d{2})/;

export function tokenize(input: string): Token[] {
  let current = 0;
  const tokens: Token[] = [];

  const lines = findLines(input);
  const location = (start: number, end: number) => {
    return {
      start: findPosition(lines, start),
      end: findPosition(lines, end)
    };
  };

  while (current < input.length) {
    let char = input[current];

    const next = (step: number = 1) => {
      current += step;
      char = input[current];
    };
    const special = (token_type: TokenType) => {
      tokens.push({ token_type, raw: char, loc: location(current, current + 1) });
      current++;
    };

    if (IS_WHITESPACE.test(char)) {
      current++;
      continue;
    }

    // Handle special characters: [, ], {, }, =, comma
    if (char === '[' || char === ']') {
      special(TokenType.Bracket);
      continue;
    }
    if (char === '{' || char === '}') {
      special(TokenType.Curly);
      continue;
    }
    if (char === '=') {
      special(TokenType.Equal);
      continue;
    }
    if (char === ',') {
      special(TokenType.Comma);
      continue;
    }

    // Handle comments = # -> EOL
    if (char === '#') {
      const start = current;
      let raw = '';
      while (!IS_NEW_LINE.test(char) && current < input.length) {
        raw += char;
        next();
      }

      tokens.push({
        token_type: TokenType.Comment,
        raw,
        loc: location(start, current)
      });
      continue;
    }

    // Multi-line literals or strings = no escaping
    const multiline_char =
      checkThree(input, current, SINGLE_QUOTE) || checkThree(input, current, DOUBLE_QUOTE);
    if (multiline_char) {
      const start = current;
      let raw = multiline_char + multiline_char + multiline_char;
      next(3);

      while (!checkThree(input, current, multiline_char) && current < input.length) {
        raw += char;
        next();
      }

      raw += multiline_char + multiline_char + multiline_char;
      current += 3;

      tokens.push({
        token_type: TokenType.String,
        raw,
        loc: location(start, current)
      });

      current++;
      continue;
    }

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
    if (!IS_VALID_LEADING_CHARACTER.test(char)) {
      throw new Error(`Unsupported character "${char}" found at ${current}`);
    }

    const start = current;
    let raw = '';
    let double_quoted = false;
    let single_quoted = false;

    while (current < input.length) {
      if (char === DOUBLE_QUOTE) double_quoted = !double_quoted;
      if (char === SINGLE_QUOTE) single_quoted = !single_quoted;

      raw += char;
      next();

      // If next character is escape and currently double-quoted,
      // check for escaped quote
      if (double_quoted && char === ESCAPE) {
        if (input[current + 1] === DOUBLE_QUOTE) {
          raw += ESCAPE + DOUBLE_QUOTE;
          next(2);
        }
      }

      // If next character is IS_WHITESPACE,
      // check if raw is full date and following is full time
      if (char === SPACE && IS_FULL_DATE.test(raw)) {
        const possibly_time = input.substr(current + 1, 8);
        if (IS_FULL_TIME.test(possibly_time)) {
          raw += SPACE;
          next();
        }
      }

      if (
        !(double_quoted || single_quoted) &&
        (IS_WHITESPACE.test(char) || char === ',' || char === ']')
      )
        break;
    }

    if (double_quoted) {
      throw new Error(`Un-closed string found starting at ${start} (${raw})`);
    }
    if (single_quoted) {
      throw new Error(`Un-closed string literal found starting at ${start} (${raw})`);
    }

    tokens.push({
      token_type: TokenType.String,
      raw,
      loc: location(start, current)
    });
  }

  return tokens;
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
