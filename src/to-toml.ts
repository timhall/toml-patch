import { Document, Value, NodeType } from './ast';
import traverse from './traverse';
import { Location } from './location';
import { SPACE, IS_NEW_LINE } from './tokenizer';

const BY_NEW_LINE = /(\r\n|\n)/g;

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
    },

    [NodeType.InlineArrayItem](node) {
      if (!node.comma) return;

      const start = node.loc.end;
      write(lines, { start, end: { line: start.line, column: start.column + 1 } }, ',');
    }
  });

  return lines.join(newline);
}

function write(lines: string[], loc: Location, raw: string) {
  const raw_lines = raw.split(BY_NEW_LINE);

  for (let i = loc.start.line; i <= loc.end.line; i++) {
    const line = getLine(lines, i);
    const is_start_line = i === loc.start.line;
    const is_end_line = i === loc.end.line;

    const before = is_start_line
      ? line.substr(0, loc.start.column).padEnd(loc.start.column, SPACE)
      : '';
    const after = is_end_line ? line.substr(loc.end.column) : '';

    lines[i - 1] = before + raw_lines[i - loc.start.line] + after;
  }
}

function getLine(lines: string[], index: number): string {
  if (!lines[index - 1]) {
    for (let i = 0; i < index; i++) {
      if (!lines[i]) lines[i] = '';
    }
  }

  return lines[index - 1];
}
