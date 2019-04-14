import {
  NodeType,
  Node,
  Document,
  Table,
  TableKey,
  TableArray,
  TableArrayKey,
  KeyValue,
  Key,
  String,
  Integer,
  Float,
  Boolean,
  DateTime,
  Comment,
  InlineArray,
  InlineArrayItem,
  InlineTable,
  InlineTableItem,
  AST
} from './ast';
import { arraysEqual } from './utils';

export type Visit<TNode = Node> = (node: TNode, parent: TNode | null) => void;
export type EnterExit<TNode = Node> = { enter?: Visit<TNode>; exit?: Visit<TNode> };
export type Path = Array<string | number>;

export type Visitor = {
  Document?: Visit<Document> | EnterExit<Document>;
  Table?: Visit<Table> | EnterExit<Table>;
  TableKey?: Visit<TableKey> | EnterExit<TableKey>;
  TableArray?: Visit<TableArray> | EnterExit<TableArray>;
  TableArrayKey?: Visit<TableArrayKey> | EnterExit<TableArrayKey>;
  KeyValue?: Visit<KeyValue> | EnterExit<KeyValue>;
  Key?: Visit<Key> | EnterExit<Key>;
  String?: Visit<String> | EnterExit<String>;
  Integer?: Visit<Integer> | EnterExit<Integer>;
  Float?: Visit<Float> | EnterExit<Float>;
  Boolean?: Visit<Boolean> | EnterExit<Boolean>;
  DateTime?: Visit<DateTime> | EnterExit<DateTime>;
  InlineArray?: Visit<InlineArray> | EnterExit<InlineArray>;
  InlineArrayItem?: Visit<InlineArrayItem> | EnterExit<InlineArrayItem>;
  InlineTable?: Visit<InlineTable> | EnterExit<InlineTable>;
  InlineTableItem?: Visit<InlineTableItem> | EnterExit<InlineTableItem>;
  Comment?: Visit<Comment> | EnterExit<Comment>;
};

export default function traverse(node: Node, visitor: Visitor) {
  function traverseArray(array: Node[], parent: Node | null) {
    array.forEach(node => {
      traverseNode(node, parent);
    });
  }

  function traverseNode(node: Node, parent: Node | null) {
    const visit = visitor[node.type];

    if (visit && typeof visit === 'function') {
      (visit as Visit)(node, parent);
    }
    if (visit && (visit as EnterExit).enter) {
      (visit as EnterExit).enter!(node, parent);
    }

    switch (node.type) {
      case NodeType.Document:
        traverseArray((node as Document).body, node);
        break;

      case NodeType.Table:
        traverseNode((node as Table).key, node);
        traverseArray((node as Table).items, node);
        break;
      case NodeType.TableKey:
        traverseNode((node as TableKey).value, node);
        break;

      case NodeType.TableArray:
        traverseNode((node as TableArray).key, node);
        traverseArray((node as TableArray).items, node);
        break;
      case NodeType.TableArrayKey:
        traverseNode((node as TableArrayKey).value, node);
        break;

      case NodeType.KeyValue:
        traverseNode((node as KeyValue).key, node);
        traverseNode((node as KeyValue).value, node);
        break;

      case NodeType.InlineArray:
        traverseArray((node as InlineArray).items, node);
        break;
      case NodeType.InlineArrayItem:
        traverseNode((node as InlineArrayItem).item, node);
        break;

      case NodeType.InlineTable:
        traverseArray((node as InlineTable).items, node);
        break;
      case NodeType.InlineTableItem:
        traverseNode((node as InlineTableItem).item, node);
        break;

      case NodeType.Key:
      case NodeType.String:
      case NodeType.Integer:
      case NodeType.Float:
      case NodeType.Boolean:
      case NodeType.DateTime:
      case NodeType.Comment:
        break;

      default:
        throw new Error(`Unrecognized node type "${node.type}"`);
    }

    if (visit && (visit as EnterExit).exit) {
      (visit as EnterExit).exit!(node, parent);
    }
  }

  traverseNode(node, null);
}

export function findByPath(ast: AST, path: Path): Node {
  const found = path.reduce((node: Node | undefined, _part, index) => {
    if (!node) return;

    if (node.type === NodeType.Document) {
      return (node as Document).body.find(block => {
        let key;
        if (block.type === NodeType.KeyValue) {
          key = block.key.value;
        } else if (block.type === NodeType.Table) {
          key = block.key.value.value;
        } else if (block.type === NodeType.TableArray) {
          key = block.key.value.value;
        }

        return !!key && arraysEqual(key, path.slice(index, index + key.length));
      }) as KeyValue | Table | TableArray | undefined;
    } else if (node.type === NodeType.Table) {
      return (node as Table).items.find(key_value => {
        if (key_value.type !== NodeType.KeyValue) return false;

        const key = key_value.key.value;
        return arraysEqual(key, path.slice(index, index + key.length));
      });
    } else if (node.type === NodeType.TableArray) {
      return (node as TableArray).items.find(key_value => {
        if (key_value.type !== NodeType.KeyValue) return false;

        const key = key_value.key.value;
        return arraysEqual(key, path.slice(index, index + key.length));
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
