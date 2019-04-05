import { Document } from './ast';

export default function parseTOML(value: string): Document {
  return {
    type: 'document',
    loc: null,
    body: []
  };
}
