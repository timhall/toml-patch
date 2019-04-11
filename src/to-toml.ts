import { Document, Value, NodeType } from './ast';
import traverse from './traverse';
import { Location } from './location';

export default function toTOML(value: Document | Value, newline: string = '\n'): string {
  const lines: string[] = [];

  traverse(value, {
    [NodeType.String](node) {
      write(lines, node.loc, node.raw);
    },
    [NodeType.Integer](node) {
      write(lines, node.loc, node.raw);
    },
    [NodeType.Float](node) {
      write(lines, node.loc, node.raw);
    },
    [NodeType.Boolean](node) {
      write(lines, node.loc, String(node.value));
    },
    [NodeType.DateTime](node) {
      write(lines, node.loc, node.raw);
    }
  });

  return lines.join(newline);
}

function write(lines: string[], loc: Location, raw: string) {
  const line = getLine(lines, loc.start.line);
  const before = line.substr(0, loc.start.column);
  const after = line.substr(loc.end.column);

  lines[loc.start.line - 1] = before + raw + after;
}

function getLine(lines: string[], index: number): string {
  if (!lines[index - 1]) {
    for (let i = 0; i < index; i++) {
      if (!lines[i]) lines[i] = '';
    }
  }

  return lines[index - 1];
}
