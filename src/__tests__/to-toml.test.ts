import toTOML from '../to-toml';
import parseTOML from '../parse-toml';
import { example } from '../__fixtures__';

test('it should convert ast to toml', () => {
  expect(toTOML(parseTOML(example))).toMatchSnapshot();
});
