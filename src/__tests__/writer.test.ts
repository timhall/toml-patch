import { insert, applyWrites } from '../writer';
import toTOML from '../to-toml';
import {
  generateInlineArray,
  generateKeyValue,
  generateInlineItem,
  generateString,
  generateDocument
} from '../generate';

test('it should insert elements into empty inline array', () => {
  const inline_array = generateInlineArray();
  const key_value = generateKeyValue(['a'], inline_array);
  const ast = [key_value];

  expect(toTOML(ast)).toEqual(`a = []\n`);

  insert(key_value, inline_array, generateInlineItem(generateString('b')));
  applyWrites(key_value);

  expect(toTOML(ast)).toEqual(`a = ["b"]\n`);

  insert(key_value, inline_array, generateInlineItem(generateString('c')));
  insert(key_value, inline_array, generateInlineItem(generateString('d')));
  insert(key_value, inline_array, generateInlineItem(generateString('e')));
  applyWrites(key_value);

  expect(toTOML(ast)).toEqual(`a = ["b", "c", "d", "e"]\n`);
});

test('it should insert first item on first line in document', () => {
  const document = generateDocument();
  const item = generateKeyValue(['a'], generateString('b'));

  insert(document, document, item);

  expect(toTOML(document.items)).toEqual(`a = "b"\n`);
});
