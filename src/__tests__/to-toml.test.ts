import toTOML from '../to-toml';
import parseTOML from '../parse-toml';
import { example, kitchen_sink, hard_example, hard_example_unicode } from '../__fixtures__';

test('it should convert ast to toml', () => {
  expect(toTOML(parseTOML(example))).toEqual(example);
});

test('it should convert kitchen sink', () => {
  expect(toTOML(parseTOML(kitchen_sink))).toEqual(kitchen_sink);
});

test('it should convert hard examples', () => {
  expect(toTOML(parseTOML(hard_example))).toEqual(hard_example);
  expect(toTOML(parseTOML(hard_example_unicode))).toEqual(hard_example_unicode);
});
