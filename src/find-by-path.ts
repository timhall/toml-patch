import {
  NodeType,
  Node,
  Document,
  Table,
  TableArray,
  KeyValue,
  InlineArray,
  InlineTable,
  AST
} from './ast';
import { arraysEqual, stableStringify, isInteger } from './utils';

export type Path = Array<string | number>;

export default function findByPath(ast: AST, path: Path): Node {
  const found = path.reduce((node: Node | undefined, part, index) => {
    if (!node) return;

    if (node.type === NodeType.Document) {
      // Documents contain KeyValue, Table, and TableArray
      // -> find KeyValue and Table by Key
      // -> find TableArray by key and index
      const indexes: { [key: string]: number } = {};
      return (node as Document).items.find(block => {
        let key: Path = [];
        if (block.type === NodeType.KeyValue) {
          key = block.key.value;
        } else if (block.type === NodeType.Table) {
          key = block.key.item.value;
        } else if (block.type === NodeType.TableArray) {
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
    } else if (node.type === NodeType.Table || node.type === NodeType.TableArray) {
      // Special case: for TableArray with part = index, continue
      if (node.type === NodeType.TableArray && isInteger(part)) {
        return node;
      }

      // Tables/TableArrays contain KeyValue and Comments
      // -> find KeyValue by key
      return (node as Table | TableArray).items.find(key_value => {
        if (key_value.type !== NodeType.KeyValue) return false;

        const key = key_value.key.value;
        return arraysEqual(key, path.slice(index, index + key.length));
      });
    } else if (node.type === NodeType.KeyValue) {
      // KeyValue can contains InlineTable or InlineArray for sub-keys
      if (
        (node as KeyValue).value.type === NodeType.InlineTable ||
        (node as KeyValue).value.type === NodeType.InlineArray
      ) {
        node = (node as KeyValue).value;
      }
    }

    // (handle InlineTable and InlineArray separately to give KeyValue chance to find)
    if (node.type === NodeType.InlineTable) {
      // InlineTables contain InlineTableItem of KeyValue
      // -> find underlying KeyValue by key
      return (node as InlineTable).items
        .map(item => item.item)
        .find(key_value => {
          const key = key_value.key.value;
          return arraysEqual(key, path.slice(index, index + key.length));
        });
    } else if (node.type === NodeType.InlineArray) {
      // InlineArrays contain InlineArrayItem of Value
      // -> find underlying Value by index
      return (node as InlineArray).items
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
