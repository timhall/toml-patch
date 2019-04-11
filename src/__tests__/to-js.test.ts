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

test('it should convert values to js', () => {
  expect(toJS(parseTOML(`"value"`))).toBe('value');
  expect(toJS(parseTOML(`0xdead_beef`))).toBe(parseInt('deadbeef', 16));
  expect(toJS(parseTOML(`3.14`))).toBe(3.14);
  expect(toJS(parseTOML(`true`))).toBe(true);
  expect(toJS(parseTOML(`2009-10-11T12:13:14Z`))).toEqual(new Date('2009-10-11T12:13:14Z'));

  expect(toJS(parseTOML(`{a="b" , c = "d" }`))).toMatchSnapshot();
  expect(toJS(parseTOML('[{a="b"} , { c = "d" } ]'))).toMatchSnapshot();
});

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
