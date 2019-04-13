import parseTOML from './parse-toml';
import parseJS from './parse-js';
import toTOML from './to-toml';
import toJS from './to-js';
import { Format } from './format';

export function parse(value: string) {
  return toJS(parseTOML(value), value);
}

export function stringify(value: any, format?: Format): string {
  return toTOML(parseJS(value, format));
}

export { default as patch } from './patch';
