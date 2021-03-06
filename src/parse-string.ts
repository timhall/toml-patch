import { SINGLE_QUOTE, DOUBLE_QUOTE } from './tokenizer';
import { pipe } from './utils';

const TRIPLE_DOUBLE_QUOTE = `"""`;
const TRIPLE_SINGLE_QUOTE = `'''`;
const LF = '\\n';
const CRLF = '\\r\\n';
const IS_CRLF = /\r\n/g;
const IS_LF = /\n/g;
const IS_LEADING_NEW_LINE = /^(\r\n|\n)/;
const IS_LINE_ENDING_BACKSLASH = /\\\s*[\n\r\n]\s*/g;

export function parseString(raw: string): string {
  if (raw.startsWith(TRIPLE_SINGLE_QUOTE)) {
    return pipe(
      trim(raw, 3),
      trimLeadingWhitespace
    );
  } else if (raw.startsWith(SINGLE_QUOTE)) {
    return trim(raw, 1);
  } else if (raw.startsWith(TRIPLE_DOUBLE_QUOTE)) {
    return pipe(
      trim(raw, 3),
      trimLeadingWhitespace,
      lineEndingBackslash,
      escapeNewLines,
      unescape
    );
  } else if (raw.startsWith(DOUBLE_QUOTE)) {
    return pipe(
      trim(raw, 1),
      unescape
    );
  } else {
    return raw;
  }
}

export function unescape(escaped: string): string {
  // JSON.parse handles everything except \UXXXXXXXX
  // replace those instances with code point, escape that, and then parse
  const LARGE_UNICODE = /\\U[a-fA-F0-9]{8}/g;
  const json_escaped = escaped.replace(LARGE_UNICODE, value => {
    const code_point = parseInt(value.replace('\\U', ''), 16);
    const as_string = String.fromCodePoint(code_point);

    return trim(JSON.stringify(as_string), 1);
  });

  return JSON.parse(`"${json_escaped}"`);
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

function lineEndingBackslash(value: string): string {
  return value.replace(IS_LINE_ENDING_BACKSLASH, '');
}
