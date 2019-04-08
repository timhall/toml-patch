import { parseString } from '../parse-string';

test('should parse double-quoted string', () => {
  expect(parseString(`"a._#\\"\\t\\"\\u1234"`)).toBe('a._#"\t"\u1234');
});

test('should parse single-quoted string', () => {
  expect(parseString(`'a._#\\"\\t\\"\\u1234'`)).toBe('a._#\\"\\t\\"\\u1234');
});

test('should parse double-quoted multiline string', () => {
  expect(
    parseString(`"""
a\\"b\\t
"""`)
  ).toBe('a"b\t\n');
});

test('should parse single-quoted multiline string', () => {
  expect(
    parseString(`'''
a\\"b\\t
'''`)
  ).toBe('a\\"b\\t\n');
});
