import parseTOML from './parse-toml';
import parseJSON from './parse-json';
import toTOML from './to-toml';
import toJSON from './to-json';

export function parse(value: string) {
  // TODO parse TOML value too (like JSON.parse('"abc"'))
  return toJSON(parseTOML(value));
}

export function stringify<TValue>(value: TValue): string {
  // TODO stringify values too (like JSON.stringify('abc'))
  return toTOML(parseJSON(value));
}

export { default as patch } from './patch';
