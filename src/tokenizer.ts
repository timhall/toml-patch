export interface Token {
  type: 'bracket' | 'curly' | 'equal' | 'comma' | 'comment' | 'quoted' | 'bare';
  value: string;
  start: number;
  end: number;
}

const WHITESPACE = /\s/;
const NEW_LINE = /\n/;
const TRIPLE_SINGLE_QUOTE = `'''`;
const TRIPLE_DOUBLE_QUOTE = `"""`;
const VALID_CHARACTERS = /[\w,\d,\",\',\+,\-,\_]/;
const DOUBLE_QUOTE = `"`;
const SINGLE_QUOTE = `'`;
const DOT = '.';
const SPACE = ' ';
const ESCAPE = '\\';
const FULL_DATE = /(\d{4})-(\d{2})-(\d{2})/;
const FULL_TIME = /(\d{2}):(\d{2}):(\d{2})/;

export function tokenize(input: string): Token[] {
  let current = 0;
  const tokens: Token[] = [];

  while (current < input.length) {
    let char = input[current];

    const next = (step: number = 1) => {
      current += step;
      char = input[current];
    };
    const special = (type: Token['type']) => {
      tokens.push({ type, value: char, start: current, end: current + 1 });
      current++;
    };

    if (WHITESPACE.test(char)) {
      current++;
      continue;
    }

    // Handle special characters: [, ], {, }, =, comma
    if (char === '[' || char === ']') {
      special('bracket');
      continue;
    }
    if (char === '{' || char === '}') {
      special('curly');
      continue;
    }
    if (char === '=') {
      special('equal');
      continue;
    }
    if (char === ',') {
      special('comma');
      continue;
    }

    // Handle comments = # -> EOL
    if (char === '#') {
      const start = current;
      let value = '';
      while (!NEW_LINE.test(char) && current < input.length) {
        value += char;
        next();
      }

      tokens.push({
        type: 'comment',
        value,
        start,
        end: current
      });
      continue;
    }

    // Multi-line literal strings = no escaping
    if (checkThree(input, current, SINGLE_QUOTE)) {
      const start = current;
      let value = TRIPLE_SINGLE_QUOTE;
      next(3);

      while (!checkThree(input, current, SINGLE_QUOTE) && current < input.length) {
        value += char;
        next();
      }

      value += TRIPLE_SINGLE_QUOTE;
      current += 3;

      tokens.push({
        type: 'quoted',
        value,
        start,
        end: current + 1
      });

      current++;
      continue;
    }

    // Multi-line string = escaping supported, but not relevant here
    if (checkThree(input, current, DOUBLE_QUOTE)) {
      const start = current;
      let value = TRIPLE_DOUBLE_QUOTE;
      next(3);

      while (!checkThree(input, current, DOUBLE_QUOTE) && current < input.length) {
        value += char;
        next();
      }

      value += TRIPLE_DOUBLE_QUOTE;
      current += 3;

      tokens.push({
        type: 'quoted',
        value,
        start,
        end: current + 1
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
    if (!VALID_CHARACTERS.test(char)) {
      throw new Error(`Unsupported character "${char}" found at ${current}`);
    }

    const start = current;
    let value = '';
    let double_quoted = false;
    let single_quoted = false;
    let dotted = false;

    while (current < input.length) {
      value += char;

      if (char === DOT && !(double_quoted || single_quoted)) dotted = true;
      if (char === DOUBLE_QUOTE) double_quoted = !double_quoted;
      if (char === SINGLE_QUOTE) single_quoted = !single_quoted;

      next();

      // If next character is escape and currently double-quoted,
      // check for escaped quote
      if (double_quoted && char === ESCAPE) {
        if (input[current + 1] === DOUBLE_QUOTE) {
          value += ESCAPE + DOUBLE_QUOTE;
          next(2);
        }
      }

      // If next character is whitespace,
      // check if value is full date and following is full time
      if (char === SPACE && FULL_DATE.test(value)) {
        const possibly_time = input.substr(current + 1, 8);
        if (FULL_TIME.test(possibly_time)) {
          value += SPACE;
          next();
        }
      }

      if (
        !(double_quoted || single_quoted) &&
        (WHITESPACE.test(char) || char === ',' || char === ']')
      )
        break;
    }

    if (double_quoted) {
      throw new Error(`Un-closed string found starting at ${start} (${value})`);
    }
    if (single_quoted) {
      throw new Error(`Un-closed string literal found starting at ${start} (${value})`);
    }

    tokens.push({
      type: (value[0] === DOUBLE_QUOTE || value[0] === SINGLE_QUOTE) && !dotted ? 'quoted' : 'bare',
      value,
      start,
      end: current
    });
  }

  return tokens;
}

function checkThree(input: string, current: number, check: string) {
  return input[current] === check && input[current + 1] === check && input[current + 2] === check;
}
