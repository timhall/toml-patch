import {
  NodeType,
  Node,
  Document,
  Table,
  TableKey,
  TableArray,
  TableArrayKey,
  KeyValue,
  InlineArray,
  InlineArrayItem,
  InlineTable,
  InlineTableItem
} from './ast';

export type Visit = (node: Node, parent: Node | null) => void;
export type EnterExit = { enter?: Visit; exit?: Visit };

export type Visitor = { [key in NodeType]?: Visit | EnterExit };

export default function traverse(document: Document, visitor: Visitor) {
  function traverseArray(array: Node[], parent: Node | null) {
    array.forEach(node => {
      traverseNode(node, parent);
    });
  }

  function traverseNode(node: Node, parent: Node | null) {
    const visit = visitor[node.type];

    if (visit && typeof visit === 'function') {
      visit(node, parent);
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

  traverseNode(document, null);
}
