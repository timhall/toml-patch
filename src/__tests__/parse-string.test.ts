import { parseString } from '../parse-string';

const double_quoted = `"a._#\\"\\t\\"\\u1234"`;
const single_quoted = `'a._#\\"\\t\\"\\u1234'`;
const multiline = `"""
a\\"b\\t
"""`;
const multiline_literal = `'''
a\\"b\\t
'''`;
const line_ending_backslash = `"""abc\\   
def"""`;

test('should parse double-quoted string', () => {
  expect(parseString(double_quoted)).toBe('a._#"\t"\u1234');
});

test('should parse single-quoted string', () => {
  expect(parseString(single_quoted)).toBe('a._#\\"\\t\\"\\u1234');
});

test('should parse double-quoted multiline string', () => {
  expect(parseString(multiline)).toBe('a"b\t\n');
});

test('should parse single-quoted multiline string', () => {
  expect(parseString(multiline_literal)).toBe('a\\"b\\t\n');
});

test('should escape unicode expressions', () => {
  expect(parseString('"\\U00000000"')).toEqual('\u0000');
});

test('should handle line-ending backslash', () => {
  expect(parseString(line_ending_backslash)).toBe('abcdef');
});
