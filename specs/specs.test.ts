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

test.each(toml_test)('toml-test - %s', async (_name, input_file, expected_file) => {
  const input = await readFile(input_file, 'utf8');
  const expected = expandJSON(JSON.parse(await readFile(expected_file, 'utf8')));

  expect(parse(input)).toEqual(expected);
});

test.each(spec_test)('spec-test - %s', async (_name, input_file, expected_file) => {
  const input = await readFile(input_file, 'utf8');
  const expected = safeLoad(await readFile(expected_file, 'utf8'));

  expect(parse(input)).toEqual(expected);
});

function expandJSON(value: any): any {
  const result: { [key: string]: any } = {};
  Object.keys(value).forEach(key => {
    result[key] = expandJSONValue(value[key]);
  });

  return result;
}

function expandJSONValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(expandJSONValue);
  } else if (value.type === 'array') {
    return value.value.map(expandJSONValue);
  } else if (value.type === 'datetime') {
    return new Date(value.value);
  } else if (value.type === 'datetime-local') {
    return new Date(value.value);
  } else if (value.type === 'date') {
    return new Date(`${value.value}T00:00:00.000Z`);
  } else if (value.type === 'time') {
    return new Date(`0000-01-01T${value.value}`);
  } else if (value.type === 'string') {
    return value.value;
  } else if (value.type === 'float') {
    return Number(value.value);
  } else if (value.type === 'integer') {
    return Number(value.value);
  } else if (value.type === 'bool') {
    return value.value === 'true';
  } else if (!('type' in value)) {
    return expandJSON(value);
  } else {
    throw new Error(`Unknown type "${value.type}"`);
  }
}
