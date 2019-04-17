import {
  NodeType,
  KeyValue,
  Table,
  InlineTable,
  TableKey,
  TableArray,
  TableArrayKey,
  InlineArray,
  isInlineTable,
  isInlineArray,
  isKeyValue,
  Document
} from './ast';
import { clonePosition, getSpan } from './location';
import { insert, remove, applyWrites } from './writer';

export interface Format {
  printWidth?: number;
  tabWidth?: number;
  useTabs?: boolean;
  trailingComma?: boolean;
  bracketSpacing?: boolean;
}

export function formatTopLevel(document: Document): Document {
  const move_to_top_level = document.items.filter(item => {
    if (!isKeyValue(item)) return false;

    const is_inline_table = isInlineTable(item.value);
    const is_inline_array =
      isInlineArray(item.value) &&
      item.value.items.length &&
      isInlineTable(item.value.items[0].item);

    return is_inline_table || is_inline_array;
  }) as KeyValue[];

  move_to_top_level.forEach(node => {
    remove(document, document, node);

    if (isInlineTable(node.value)) {
      insert(document, document, formatTable(node));
    } else {
      formatTableArray(node).forEach(table_array => {
        insert(document, document, table_array);
      });
    }
  });

  applyWrites(document);
  return document;
}

function formatTable(key_value: KeyValue): Table {
  const { columns: key_width } = getSpan(key_value.key.loc);
  const key: TableKey = {
    type: NodeType.TableKey,
    loc: {
      start: { line: 1, column: 0 },
      end: { line: 1, column: key_width + 2 }
    },
    item: {
      type: NodeType.Key,
      loc: {
        start: { line: 1, column: 1 },
        end: { line: 1, column: key_width + 1 }
      },
      raw: key_value.key.raw,
      value: key_value.key.value
    }
  };

  const table: Table = {
    type: NodeType.Table,
    loc: {
      start: { line: 1, column: 0 },
      end: { line: 1, column: key_width + 2 }
    },
    key,
    items: []
  };

  (key_value.value as InlineTable).items.forEach(item => {
    insert(table, table, item.item);
  });

  applyWrites(table);
  return table;
}

function formatTableArray(key_value: KeyValue): TableArray[] {
  const { columns: key_width } = getSpan(key_value.key.loc);
  const root = placeholder();

  (key_value.value as InlineArray).items.forEach(item => {
    const key: TableArrayKey = {
      type: NodeType.TableArrayKey,
      loc: {
        start: { line: 1, column: 0 },
        end: { line: 1, column: key_width + 4 }
      },
      item: {
        type: NodeType.Key,
        loc: {
          start: { line: 1, column: 2 },
          end: { line: 1, column: key_width + 2 }
        },
        raw: key_value.key.raw,
        value: key_value.key.value
      }
    };

    const table_array: TableArray = {
      type: NodeType.TableArray,
      loc: {
        start: { line: 1, column: 0 },
        end: clonePosition(key.loc.end)
      },
      key,
      items: []
    };
    insert(root, root, table_array);

    (item.item as InlineTable).items.forEach(item => {
      insert(root, table_array, item.item);
    });
  });

  applyWrites(root);
  return root.items as TableArray[];
}

export function formatPrintWidth(document: Document, format: Format): Document {
  return document;
}

function placeholder(): Document {
  return {
    type: NodeType.Document,
    loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
    items: []
  };
}
