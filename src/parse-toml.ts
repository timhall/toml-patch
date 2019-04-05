import { Document } from './ast';
import { Token, tokenize } from './tokenizer';

export default function parseTOML(value: string): Document {
  const normalized = normalize(value);
  const tokens = tokenize(normalized);
  const parsed = parse(tokens);

  return parsed;
}

export function normalize(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

export function parse(tokens: Token[]): Document {
  return {
    type: 'document',
    loc: null,
    body: []
  };
}
