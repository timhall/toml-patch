import {
  NodeType,
  Node,
  Document,
  Table,
  TableArray,
  KeyValue,
  AST,
  isDocument,
  isKeyValue,
  isTable,
  isTableArray,
  isInlineTable,
  isInlineArray
} from './ast';
import { arraysEqual, stableStringify, isInteger } from './utils';

export type Path = Array<string | number>;

export default function findByPath(ast: AST, path: Path): Node {
  const found = path.reduce((node: Node | undefined, part, index) => {
    if (!node) return;

    if (isDocument(node)) {
      // Documents contain KeyValue, Table, and TableArray
      // -> find KeyValue and Table by Key
      // -> find TableArray by key and index
      const indexes: { [key: string]: number } = {};
      return (node as Document).items.find(block => {
        let key: Path = [];
        if (isKeyValue(block)) {
          key = block.key.value;
        } else if (isTable(block)) {
          key = block.key.item.value;
        } else if (isTableArray(block)) {
          key = block.key.item.value;

          const key_string = stableStringify(key);
          if (!indexes[key_string]) {
            indexes[key_string] = 0;
          }
          const array_index = indexes[key_string]++;

          key = key.concat(array_index);
        }

        return key.length > 0 && arraysEqual(key, path.slice(index, index + key.length));
      }) as KeyValue | Table | TableArray | undefined;
    } else if (isTable(node) || isTableArray(node)) {
      // Special case: for TableArray with part = index, continue
      if (isTableArray(node) && isInteger(part)) {
        return node;
      }

      // Tables/TableArrays contain KeyValue and Comments
      // -> find KeyValue by key
      return node.items.find(key_value => {
        if (key_value.type !== NodeType.KeyValue) return false;

        const key = key_value.key.value;
        return arraysEqual(key, path.slice(index, index + key.length));
      });
    } else if (isKeyValue(node)) {
      // KeyValue can contains InlineTable or InlineArray for sub-keys
      if (isInlineTable(node.value) || isInlineArray(node.value)) {
        node = node.value;
      }
    }

    // (handle InlineTable and InlineArray separately to give KeyValue chance to find)
    if (isInlineTable(node)) {
      // InlineTables contain InlineTableItem of KeyValue
      // -> find underlying KeyValue by key
      return node.items
        .map(item => item.item)
        .find(key_value => {
          const key = key_value.key.value;
          return arraysEqual(key, path.slice(index, index + key.length));
        });
    } else if (isInlineArray(node)) {
      // InlineArrays contain InlineArrayItem of Value
      // -> find underlying Value by index
      return node.items
        .map(item => item.item)
        .find((_node, inline_index) => {
          return inline_index === path[index];
        });
    } else {
      return;
    }
  }, ast);

  if (!found) {
    throw new Error(`Could not find node at path ${path.join('.')}`);
  }

  return found;
}
