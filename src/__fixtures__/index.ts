import { join } from 'path';
import { readFileSync } from 'fs';

function read(filename: string): string {
  return readFileSync(join(__dirname, filename), { encoding: 'utf8' });
}

export const example = read('example.toml');
export const fruit = read('fruit.toml');
export const hard_example = read('hard-example.toml');
export const hard_example_unicode = read('hard-example-unicode.toml');
export const kitchen_sink = read('kitchen-sink.toml');
export const spec_01_example = read('0A-spec-01-example-v0.4.0.toml');
