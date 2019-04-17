import {
  NodeType,
  Block,
  KeyValue,
  Table,
  InlineTable,
  TableKey,
  TableArray,
  TableArrayKey,
  InlineArray,
  isInlineTable,
  isInlineArray
} from './ast';
import { clonePosition, Position } from './location';
import { last, flatMap } from './utils';
import { shiftNode as shift } from './writer';

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
    const is_inline_table = isInlineTable(key_value.value);
    const is_inline_array =
      isInlineArray(key_value.value) &&
      key_value.value.items.length &&
      isInlineTable(key_value.value.items[0].item);

    if (is_inline_table || is_inline_array) {
      top_level.push(key_value);
      return false;
    }

    shift(key_value, { lines: line - key_value.loc.start.line, columns: 0 });
    line += 1;

    return true;
  });

  let start = { line: line + 1, column: 0 };
  const as_tables: Array<Table | TableArray> = flatMap<KeyValue, Table | TableArray>(
    top_level,
    key_value => {
      let table: Table | TableArray[];
      if (isInlineTable(key_value.value)) {
        table = formatTable(key_value, start);
        start = { line: table.loc.end.line + 2, column: 0 };
      } else {
        table = formatTableArray(key_value, start);
        start = { line: last(table)!.loc.end.line + 2, column: 0 };
      }

      return table;
    }
  );

  return inline.concat(as_tables);
}

function formatTable(key_value: KeyValue, start: Position): Table {
  const key_width = key_value.key.loc.end.column - key_value.key.loc.start.column;
  const key: TableKey = {
    type: NodeType.TableKey,
    loc: {
      start: clonePosition(start),
      end: { line: start.line, column: start.column + key_width + 2 }
    },
    item: {
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
      columns: item_start.column - item.loc.start.column,
      lines: item_start.line - item.loc.start.line
    });

    item_start = { line: item.item.loc.end.line + 1, column: 0 };
    return item.item;
  });

  const end = items.length ? last(items)!.loc.end : key.loc.end;
  return {
    type: NodeType.Table,
    loc: { start, end: clonePosition(end) },
    key,
    items
  };
}

function formatTableArray(key_value: KeyValue, start: Position): TableArray[] {
  const key_width = key_value.key.loc.end.column - key_value.key.loc.start.column;
  let line = start.line;

  return (key_value.value as InlineArray).items.map(item => {
    const key: TableArrayKey = {
      type: NodeType.TableArrayKey,
      loc: {
        start: { line, column: 0 },
        end: { line, column: key_width + 4 }
      },
      item: {
        type: NodeType.Key,
        loc: {
          start: { line, column: 2 },
          end: { line, column: key_width + 2 }
        },
        raw: key_value.key.raw,
        value: key_value.key.value
      }
    };

    let item_start = { line: line + 1, column: 0 };
    const items: KeyValue[] = (item.item as InlineTable).items.map(item => {
      shift(item.item, {
        columns: item_start.column - item.loc.start.column,
        lines: item_start.line - item.loc.start.line
      });

      item_start = { line: item.item.loc.end.line + 1, column: 0 };
      return item.item;
    });

    const end = items.length ? last(items)!.loc.end : key.loc.end;
    line = end.line + 2;

    return {
      type: NodeType.TableArray,
      loc: { start: { line, column: 0 }, end: clonePosition(end) },
      key,
      items
    };
  });
}

export function formatPrintWidth(body: Block[], format: Format): Block[] {
  return body;
}
