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

const hard = `
# Test file for TOML
# Only this one tries to emulate a TOML file written by a user of the kind of parser writers probably hate
# This part you'll really hate

[the]
test_string = "You'll hate me after this - #"          # " Annoying, isn't it?

    [the.hard]
    test_array = [ "] ", " # "]      # ] There you go, parse this!
    test_array2 = [ "Test #11 ]proved that", "Experiment #9 was a success" ]
    # You didn't think it'd as easy as chucking out the last #, did you?
    another_test_string = " Same thing, but with a string #"
    harder_test_string = " And when \\"'s are in the string, along with # \\""   # "and comments are there too"
    # Things will get harder

        [the.hard."bit#"]
        "what?" = "You don't think some user won't do that?"
        multi_line_array = [
            "]",
            # ] Oh yes I did
            ]
`;

test.only('it should parse hard document', () => {
  const parsed = parseTOML(hard);

  expect(parsed).toMatchSnapshot();
});
