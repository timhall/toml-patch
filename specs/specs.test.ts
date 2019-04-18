import { promisify } from 'util';
import { join, basename } from 'path';
import { readFile as _readFile, existsSync } from 'fs';
import { sync as glob } from 'glob';
import { safeLoad } from 'js-yaml';
import { parse } from '../';

const readFile = promisify(_readFile);

const toml_test_dir = join(__dirname, '../submodules/toml-test/tests/valid');
const toml_test_input = glob(join(toml_test_dir, '*.toml'));

const toml_test = toml_test_input
  .map(input => {
    const name = basename(input, '.toml');
    const expected = join(toml_test_dir, `${name}.json`);
    if (!existsSync(expected)) return;

    return [name, input, expected];
  })
  .filter(Boolean) as Array<string[]>;

const spec_test_dir = join(__dirname, '../submodules/spec-tests/values');
const spec_test_input = glob(join(spec_test_dir, '*.toml'));

const spec_test = spec_test_input
  .map(input => {
    const name = basename(input, '.toml');
    const expected = join(spec_test_dir, `${name}.yaml`);
    if (!existsSync(expected)) return;

    return [name, input, expected];
  })
  .filter(Boolean) as Array<string[]>;

test.skip.each(toml_test)('toml-test - %s', async (_name, input_file, expected_file) => {
  const input = await readFile(input_file, 'utf8');
  const expected = JSON.parse(await readFile(expected_file, 'utf8'));

  expect(parse(input)).toEqual(expected);
});

test.each(spec_test)('spec-test - %s', async (_name, input_file, expected_file) => {
  const input = await readFile(input_file, 'utf8');
  const expected = safeLoad(await readFile(expected_file, 'utf8'));

  expect(parse(input)).toEqual(expected);
});
