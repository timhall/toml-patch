const DOUBLE_QUOTE = `"`;
const SINGLE_QUOTE = `'`;
const TRIPLE_DOUBLE_QUOTE = `"""`;
const TRIPLE_SINGLE_QUOTE = `'''`;
const DOT = `.`;
const ESCAPE = '\\';
const LF = '\\n';
const CRLF = '\\r\\n';
const IS_CRLF = /\r\n/g;
const IS_LF = /\n/g;
const IS_LEADING_NEW_LINE = /^(\r\n|\n)/;

export function parseString(raw: string): string {
  if (raw.startsWith(TRIPLE_SINGLE_QUOTE)) {
    return trimLeadingWhitespace(trim(raw, 3));
  } else if (raw.startsWith(SINGLE_QUOTE)) {
    return trim(raw, 1);
  } else if (raw.startsWith(TRIPLE_DOUBLE_QUOTE)) {
    return unescape(escapeNewLines(trimLeadingWhitespace(trim(raw, 3))));
  } else {
    return unescape(trim(raw, 1));
  }
}

export function parseKey(raw: string): string[] {
  // "abc".'def'.hij
  // ^---^ ^---^ ^-^
  // 0    56    11

  const parts = [];
  let double_quoted = false;
  let single_quoted = false;
  let index = 0;
  let current = 0;

  while (current < raw.length) {
    let char = raw[current];

    if (char === DOT && !double_quoted && !single_quoted) {
      parts.push(raw.substr(index, current - index));
      index = current + 1;
    } else if (char === DOUBLE_QUOTE && !single_quoted) {
      double_quoted = !double_quoted;
    } else if (char === SINGLE_QUOTE && !double_quoted) {
      single_quoted = !single_quoted;
    } else if (double_quoted && char === ESCAPE && raw[current + 1] === DOUBLE_QUOTE) {
      // (skip over double-quote)
      current++;
    }

    current++;
  }

  parts.push(raw.substr(index, raw.length - index));

  return parts.map(part =>
    part[0] === DOUBLE_QUOTE || part[0] === SINGLE_QUOTE ? parseString(part) : part
  );
}

export function unescape(escaped: string): string {
  return JSON.parse(`"${escaped}"`);
}

export function escape(value: string): string {
  return trim(JSON.stringify(value), 1);
}

function trim(value: string, count: number): string {
  return value.substr(count, value.length - count * 2);
}

function trimLeadingWhitespace(value: string): string {
  return IS_LEADING_NEW_LINE.test(value) ? value.substr(1) : value;
}

function escapeNewLines(value: string): string {
  return value.replace(IS_CRLF, CRLF).replace(IS_LF, LF);
}
