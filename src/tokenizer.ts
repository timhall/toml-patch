export interface Token {
  type: 'bracket' | 'equal' | 'comment' | 'quoted' | 'bare';
  value: string;
  start: number;
  end: number;
}

const WHITESPACE = /\s/;
const NEW_LINE = /\n/;
const DOUBLE_QUOTE = `"`;
const TRIPLE_DOUBLE_QUOTE = `"""`;
const SINGLE_QUOTE = `'`;
const TRIPLE_SINGLE_QUOTE = `'''`;
const ESCAPE = '\\';
const FULL_DATE = /(\d{4})-(\d{2})-(\d{2})/;
const FULL_TIME = /(\d{2})-(\d{2})-(\d{2})/;

export function tokenize(input: string): Token[] {
  let current = 0;
  const tokens: Token[] = [];

  while (current < input.length) {
    let char = input[current];

    if (WHITESPACE.test(char)) {
      current++;
      continue;
    }

    // 1. Bracket (open or closing, single or double)
    if (char === '[' || char === ']') {
      tokens.push({
        type: 'bracket',
        value: char,
        start: current,
        end: current + 1
      });

      current++;
      continue;
    }

    // 2. Equal sign
    if (char === '=') {
      tokens.push({
        type: 'equal',
        value: char,
        start: current,
        end: current + 1
      });

      current++;
      continue;
    }

    // 3. Comment
    if (char === '#') {
      const start = current;
      let value = '';
      while (!NEW_LINE.test(char) && current < input.length) {
        value += char;
        char = input[++current];
      }

      tokens.push({
        type: 'comment',
        value,
        start,
        end: current - 1
      });

      continue;
    }

    // Multi-line literal strings = no escaping
    if (checkThree(input, current, SINGLE_QUOTE)) {
      const start = current;
      let value = TRIPLE_SINGLE_QUOTE;
      current += 3;

      while (!checkThree(input, current, SINGLE_QUOTE) && current < input.length) {
        value += char;
        char = input[++current];
      }

      value += TRIPLE_SINGLE_QUOTE;
      current += 3;

      tokens.push({
        type: 'quoted',
        value,
        start,
        end: current
      });
    }

    // Multi-line string
    // Note: While escaping is supported, there is no way for """ to match escaped portion
    if (checkThree(input, current, DOUBLE_QUOTE)) {
      const start = current;
      let value = TRIPLE_DOUBLE_QUOTE;
      current += 3;

      while (!checkThree(input, current, DOUBLE_QUOTE) && current < input.length) {
        value += char;
        char = input[++current];
      }

      value += TRIPLE_DOUBLE_QUOTE;
      current += 3;

      tokens.push({
        type: 'quoted',
        value,
        start,
        end: current
      });
    }

    // Literal string = no escaping
    if (char === SINGLE_QUOTE) {
      const start = current;
      let value = char;
      current++;

      while (char !== SINGLE_QUOTE && current < input.length) {
        value += char;
        char = input[++current];
      }

      value += SINGLE_QUOTE;
      current++;

      tokens.push({
        type: 'quoted',
        value,
        start,
        end: current
      });
    }
    if (char === DOUBLE_QUOTE) {
      const start = current;
      let value = char;
      current++;

      while (char !== DOUBLE_QUOTE && current < input.length) {
        value += char;
        char = input[++current];

        // For escape character, skip to next to avoid \" check
        if (char === ESCAPE) {
          value += char;
          char = input[++current];
        }
      }

      value += DOUBLE_QUOTE;
      current++;

      tokens.push({
        type: 'quoted',
        value,
        start,
        end: current
      });
    }

    // bare = key, integer, float, boolean, datetime
    //
    // For the most part, just look for next whitespace
    // BUT See https://github.com/toml-lang/toml#offset-date-time
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

    const start = current;
    let value = '';

    while (!WHITESPACE.test(char) && current < input.length) {
      value += char;
      char = input[++current];

      if (WHITESPACE.test(char) && FULL_DATE.test(value)) {
        // 1. Check if value is full date (above)
        // 2. Check if following value is full time
        const possibly_time = input.substr(current + 1, 8);
        if (FULL_TIME.test(possibly_time)) {
          char = input[++current];
        }
      }
    }

    tokens.push({
      type: 'bare',
      value,
      start,
      end: current - 1
    });

    current++;
  }

  return tokens;
}

function checkThree(input: string, current: number, check: string) {
  return input[current] === check && input[current + 1] === check && input[current + 2] === check;
}
