import { parseString, parseKey } from '../parse-string';

describe('parseString', () => {
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
});

describe('parseKey', () => {
  test('should parse single bare key', () => {
    expect(parseKey('abc')).toEqual(['abc']);
  });

  test('should parse single literal key', () => {
    expect(parseKey(`'abc\\"'`)).toEqual(['abc\\"']);
  });

  test('should parse single double-quoted key', () => {
    expect(parseKey(`"abc\\""`)).toEqual(['abc"']);
  });

  test('should parse dotted key', () => {
    expect(parseKey(`abc.'abc\\"'."abc\\""`)).toEqual(['abc', 'abc\\"', 'abc"']);
  });
});
