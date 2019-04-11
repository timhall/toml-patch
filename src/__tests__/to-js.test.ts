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
