import { Document } from './ast';

export default function parseJSON<TValue>(value: TValue): Document {
  return {
    type: 'document',
    loc: null,
    body: []
  };
}
