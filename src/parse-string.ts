import { SINGLE_QUOTE, DOUBLE_QUOTE } from './tokenizer';

const TRIPLE_DOUBLE_QUOTE = `"""`;
const TRIPLE_SINGLE_QUOTE = `'''`;
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
  } else if (raw.startsWith(DOUBLE_QUOTE)) {
    return unescape(trim(raw, 1));
  } else {
    return raw;
  }
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
