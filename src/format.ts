import { NodeType, Block, KeyValue, Table, Node, InlineTable, TableKey, InlineArray } from './ast';
import traverse from './traverse';
import { clonePosition } from './location';
import { last } from './utils';

export interface Format {
  printWidth?: number;
  tabWidth?: number;
  useTabs?: boolean;
  trailingComma?: boolean;
  bracketSpacing?: boolean;
}

export function formatTopLevel(body: Block[]): Block[] {
  const top_level: KeyValue[] = [];
  let line = 1;
  const inline: Block[] = (body as KeyValue[]).filter(key_value => {
    if (key_value.value.type === NodeType.InlineTable) {
      top_level.push(key_value);
      return false;
    }

    shift(key_value, { y: line - key_value.loc.start.line });
    line += 1;

    return true;
  });

  let start = { line: line + 1, column: 0 };
  const as_tables: Array<Table> = top_level.map(key_value => {
    const key_width = key_value.key.loc.end.column - key_value.key.loc.start.column;
    const key: TableKey = {
      type: NodeType.TableKey,
      loc: { start, end: { line: start.line, column: start.column + key_width + 2 } },
      value: {
        type: NodeType.Key,
        loc: {
          start: { line: start.line, column: start.column + 1 },
          end: { line: start.line, column: start.column + 1 + key_width }
        },
        raw: key_value.key.raw,
        value: key_value.key.value
      }
    };

    let item_start = { line: start.line + 1, column: 0 };
    const items: KeyValue[] = (key_value.value as InlineTable).items.map(item => {
      shift(item.item, {
        x: item_start.column - item.loc.start.column,
        y: item_start.line - item.loc.start.line
      });

      item_start = { line: item.item.loc.end.line + 1, column: 0 };
      return item.item;
    });

    const end = items.length ? last(items)!.loc.end : key.loc.end;
    const table: Table = {
      type: NodeType.Table,
      loc: { start: clonePosition(start), end: clonePosition(end) },
      key,
      items
    };

    start = { line: end.line + 2, column: 0 };

    return table;
  });

  return inline.concat(as_tables);
}

export function formatPrintWidth(body: Block[], format: Format): Block[] {
  return body;
}

function shift(node: Node, distance: { y?: number; x?: number }): Node {
  const { x = 0, y = 0 } = distance;
  const move = (node: Node) => {
    node.loc.start.column += x;
    node.loc.end.column += x;
    node.loc.start.line += y;
    node.loc.end.line += y;
  };

  traverse(node, {
    [NodeType.Table]: move,
    [NodeType.TableKey]: move,
    [NodeType.TableArray]: move,
    [NodeType.TableArrayKey]: move,
    [NodeType.KeyValue](node) {
      move(node);
      node.equals += x;
    },
    [NodeType.Key]: move,
    [NodeType.String]: move,
    [NodeType.Integer]: move,
    [NodeType.Float]: move,
    [NodeType.Boolean]: move,
    [NodeType.DateTime]: move,
    [NodeType.InlineArray]: move,
    [NodeType.InlineArrayItem]: move,
    [NodeType.InlineTable]: move,
    [NodeType.InlineTableItem]: move,
    [NodeType.Comment]: move
  });

  return node;
}
