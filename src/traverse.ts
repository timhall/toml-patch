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
  Value,
  String,
  Integer,
  Float,
  Boolean,
  DateTime,
  Comment,
  InlineArray,
  InlineArrayItem,
  InlineTable,
  InlineTableItem
} from './ast';

export type Visit<TNode = Node> = (node: TNode, parent: TNode | null) => void;
export type EnterExit<TNode = Node> = { enter?: Visit<TNode>; exit?: Visit<TNode> };

export type Visitor = {
  Document?: Visit<Document> | EnterExit<Document>;
  Table?: Visit<Table> | EnterExit<Table>;
  TableKey?: Visit<TableKey>;
  TableArray?: Visit<TableArray>;
  TableArrayKey?: Visit<TableArrayKey>;
  KeyValue?: Visit<KeyValue>;
  Key?: Visit<Key>;
  String?: Visit<String>;
  Integer?: Visit<Integer>;
  Float?: Visit<Float>;
  Boolean?: Visit<Boolean>;
  DateTime?: Visit<DateTime>;
  InlineArray?: Visit<InlineArray>;
  InlineArrayItem?: Visit<InlineArrayItem>;
  InlineTable?: Visit<InlineTable>;
  InlineTableItem?: Visit<InlineTableItem>;
  Comment?: Visit<Comment>;
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
        traverseArray((node as Table).items, node);
        break;
      case NodeType.TableKey:
        traverseNode((node as TableKey).value, node);
        break;

      case NodeType.TableArray:
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
