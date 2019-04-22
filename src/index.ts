import parseTOML from './parse-toml';
import parseJS from './parse-js';
import toTOML from './to-toml';
import toJS from './to-js';
import { Format } from './format';

export function parse(value: string): any {
  return toJS(parseTOML(value), value);
}

export function stringify(value: any, format?: Format): string {
  const document = parseJS(value, format);
  return toTOML(document.items);
}

export { default as patch } from './patch';
