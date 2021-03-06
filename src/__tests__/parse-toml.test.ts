import parseTOML from '../parse-toml';
import { Table, KeyValue, InlineArray, DateTime, Document, AST } from '../ast';
import { example, fruit, hard_example, hard_example_unicode, kitchen_sink } from '../__fixtures__';

test('it should parse inline table', () => {
  expect([...parseTOML(`key = { end = true}`)]).toMatchSnapshot();
});

test('it should parse examples', () => {
  expect([...parseTOML(example)]).toMatchSnapshot();
  expect([...parseTOML(fruit)]).toMatchSnapshot();
});

test('it should parse kitchen sink', () => {
  const parsed = [...parseTOML(kitchen_sink)];

  // Normalize local dates and times
  const date_local = (parsed[2] as Table).items[5] as KeyValue;
  const array_items = (date_local.value as InlineArray<DateTime>).items;
  array_items.forEach(array_item => {
    // @ts-ignore Type 'string' is not assignable to type 'Date'
    array_item.item.value = `${Object.prototype.toString.call(array_item.item.value)}`;
  });

  expect(parsed).toMatchSnapshot();
});

test('it should parse hard examples', () => {
  expect([...parseTOML(hard_example)]).toMatchSnapshot();
  expect([...parseTOML(hard_example_unicode)]).toMatchSnapshot();
});

test('it should parse table key', () => {
  expect([...parseTOML(`[a.b.c]`)]).toMatchSnapshot();
});

test('it should parse table array key', () => {
  expect([...parseTOML(`[[a.b.c]]`)]).toMatchSnapshot();
});

test('it should parse -0', () => {
  expect([...parseTOML(`a = -0`)]).toMatchSnapshot();
});

test('should parse newlines in string', () => {
  expect([
    ...parseTOML(`
    a = "val\\nue"
    b = """value\\n"""
  `)
  ]).toMatchSnapshot();
});
