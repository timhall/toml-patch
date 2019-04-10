import parseTOML from './parse-toml';
import parseJS from './parse-js';
import toTOML from './to-toml';
import toJS from './to-js';

export function parse(value: string) {
  return toJS(parseTOML(value));
}

export function stringify<TValue>(value: TValue): string {
  // TODO stringify values too (like JSON.stringify('abc'))
  return toTOML(parseJS(value));
}

export { default as patch } from './patch';
