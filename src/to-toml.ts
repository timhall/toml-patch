import { NodeType, AST } from './ast';
import traverse from './traverse';
import { Location } from './location';
import { SPACE } from './tokenizer';

const BY_NEW_LINE = /(\r\n|\n)/g;

export default function toTOML(ast: AST, newline: string = '\n'): string {
  const lines: string[] = [];

  traverse(ast, {
    [NodeType.TableKey](node) {
      const { start, end } = node.loc;

      write(lines, { start, end: { line: start.line, column: start.column + 1 } }, '[');
      write(lines, { start: { line: end.line, column: end.column - 1 }, end }, ']');
    },
    [NodeType.TableArrayKey](node) {
      const { start, end } = node.loc;

      write(lines, { start, end: { line: start.line, column: start.column + 2 } }, '[[');
      write(lines, { start: { line: end.line, column: end.column - 2 }, end }, ']]');
    },

    [NodeType.KeyValue](node) {
      const {
        start: { line }
      } = node.loc;
      write(
        lines,
        { start: { line, column: node.equals }, end: { line, column: node.equals + 1 } },
        '='
      );
    },
    [NodeType.Key](node) {
      write(lines, node.loc, node.raw);
    },

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

    [NodeType.InlineArray](node) {
      const { start, end } = node.loc;
      write(lines, { start, end: { line: start.line, column: start.column + 1 } }, '[');
      write(lines, { start: { line: end.line, column: end.column - 1 }, end }, ']');
    },

    [NodeType.InlineTable](node) {
      const { start, end } = node.loc;
      write(lines, { start, end: { line: start.line, column: start.column + 1 } }, '{');
      write(lines, { start: { line: end.line, column: end.column - 1 }, end }, '}');
    },
    [NodeType.InlineItem](node) {
      if (!node.comma) return;

      const start = node.loc.end;
      write(lines, { start, end: { line: start.line, column: start.column + 1 } }, ',');
    },

    [NodeType.Comment](node) {
      write(lines, node.loc, node.raw);
    }
  });

  return lines.join(newline) + newline;
}

function write(lines: string[], loc: Location, raw: string) {
  const raw_lines = raw.split(BY_NEW_LINE);
  const expected_lines = loc.end.line - loc.start.line + 1;

  if (raw_lines.length !== expected_lines) {
    throw new Error(
      `Mismatch between location and raw string, expected ${expected_lines} lines for "${raw}"`
    );
  }

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
