import { NodeType, Document } from './ast';

export default function parseJS<TValue>(value: TValue): Document {
  return {
    type: NodeType.Document,
    loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
    body: []
  };
}
