import parseTOML from '../parse-toml';
import toJS from '../to-js';
import {
  example,
  fruit,
  kitchen_sink,
  hard_example,
  hard_example_unicode,
  spec_01_example
} from '../__fixtures__';

test('it should convert examples to js', () => {
  expect(toJS(parseTOML(example))).toMatchSnapshot();
  expect(toJS(parseTOML(fruit))).toMatchSnapshot();
});

test('it should convert kitchen sink to JS', () => {
  const js = toJS(parseTOML(kitchen_sink));

  // Normalize local dates and times
  js.values.date.local = js.values.date.local.map((date: Date) => {
    // TODO Need to validate the actual dates in timezone/date independent way
    return Object.prototype.toString.call(date);
  });

  expect(js).toMatchSnapshot();
});

test('it should convert hard examples to JS', () => {
  expect(toJS(parseTOML(hard_example))).toMatchSnapshot();
  expect(toJS(parseTOML(hard_example_unicode))).toMatchSnapshot();
});

test('it should convert spec examples to JS', () => {
  expect(toJS(parseTOML(spec_01_example))).toMatchSnapshot();
});

const multiple_keys = `
  a.b.c = 1
  a.d = 2
  a.e = 3

  # Invalid
  a.e.f = 4
`;

const multiple_tables = `
  [a]
  b = 2

  [a]
  c = 3
`;

const static_array = `
  fruit = []

  [[fruit]]
`;

const table_table_array = `
  [a]
  b = 2

  [[a]]
  c = 3
`;

const table_array_table = `
[[fruit]]
  name = "apple"

  [[fruit.variety]]
    name = "red delicious"

  # This table conflicts with the previous table
  [fruit.variety]
    name = "granny smith"
`;

const inline_array_key = `
a = [1, 2, 3]
a.b = 4
`;

describe('validation', () => {
  test("it shouldn't allow writing to the same key multiple times", () => {
    expect(() => toJS(parseTOML(multiple_keys))).toThrow(
      /Invalid key\, a value has already been defined for a\.e/
    );
  });

  test("it shouldn't allow repeat table keys", () => {
    expect(() => toJS(parseTOML(multiple_tables))).toThrow(
      /Invalid key\, a table has already been defined named a/
    );
  });

  test("it shouldn't allow appending to static array", () => {
    expect(() => toJS(parseTOML(static_array))).toThrow(
      /Invalid key\, cannot add to a static array/
    );
  });

  test("it shouldn't allow appending table array to table", () => {
    expect(() => toJS(parseTOML(table_table_array))).toThrow(
      /Invalid key\, cannot add an array of tables to a table/
    );
  });

  test("it shouldn't allow appending table to table array", () => {
    expect(() => toJS(parseTOML(table_array_table))).toThrow(
      /Invalid key\, a table has already been defined named/
    );
  });

  test("it shouldn't allow appending key to inline array", () => {
    expect(() => toJS(parseTOML(inline_array_key))).toThrow(
      /Invalid key\, cannot add to a static array/
    );
  });
});
