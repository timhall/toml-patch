import parseTOML from '../parse-toml';
import { Table, KeyValue, InlineArray, DateTime, InlineArrayItem } from '../ast';

test('it should parse simple document', () => {
  expect(parseTOML(`a = "b"`)).toMatchSnapshot();
});

const complex = `# This is a TOML document.

title = "TOML Example"

[values]
string = "string..."
integer = [ 1_234 , 0xdead_beef , 0o01234567 , 0o755 , 0b11010110 ]
float = [ 1_234.567 , -0.01 , 5e+22 , 1E6 , inf , -inf , nan , -nan ]  
boolean = true
date = [
  1979-05-27T07:32:00Z,
  1979-05-27T00:32:00-07:00,
  1979-05-27T00:32:00.999999-07:00,
  1979-05-27 07:32:00Z,
  
]

date.local = [
  1979-05-27T07:32:00,
  1979-05-27, # Local Date
  07:32:00    # Local Time
]

array.nested = [ [ 1, 2 ], ["a", "b", "c"] ]
array.trailing = [
  1,
  2, # this is ok
]

table.dotted = { type.name = "pug" }

# Table
[dog."tater.man"]
type.name = "pug"

# TODO [ j . "ʞ" . 'l' ]

# Array Table
[[products]]
name = "Hammer"
sku = 738594937

[[products]]

[[products]]
name = "Nail"
sku = 284758393
color = "gray"`;

test('it should parse complex document', () => {
  const parsed = parseTOML(complex);

  // Normalize local dates and times
  const date_local = (parsed.body[2] as Table).items[5] as KeyValue;
  const array_items = (date_local.value as InlineArray<DateTime>).items;
  array_items.forEach(array_item => {
    // @ts-ignore Type 'string' is not assignable to type 'Date'
    array_item.item.value = `${Object.prototype.toString.call(array_item.item.value)}`;
  });

  expect(parsed).toMatchSnapshot();
});

test('it should parse complex fixture', () => {
  //
});
