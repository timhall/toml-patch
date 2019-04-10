import { Document, Value, NodeType, isValue, Node } from './ast';
import traverse from './traverse';
import { BlankObject, last, blank } from './utils';

export type primitive = string | number | boolean | Date;

export default function toJS(document: Document | Value): any {
  if (isValue(document) && document.type !== NodeType.InlineTable) return toValue(document);

  const result = blank();
  let active: any = result;

  traverse(document, {
    [NodeType.Table](node) {
      const key = node.key.value.value;
      active = ensureTable(result, key);
    },

    [NodeType.TableArray](node) {
      const key = node.key.value.value;
      active = ensureTableArray(result, key);
    },

    [NodeType.KeyValue](node) {
      const key = node.key.value;
      const value = toValue(node.value);

      const target = key.length > 1 ? ensureTable(active, key.slice(0, -1)) : active;
      target[last(key)!] = value;
    }
  });

  return result;
}

export function toValue(node: Value): any {
  switch (node.type) {
    case NodeType.InlineTable:
      return toJS(node);

    case NodeType.InlineArray:
      return node.items.map(item => toValue(item.item as Value));

    case NodeType.String:
    case NodeType.Integer:
    case NodeType.Float:
    case NodeType.Boolean:
    case NodeType.DateTime:
      return node.value;

    default:
      throw new Error(`Unrecognized value type "${(node as Node).type}"`);
  }
}

function ensureTable(object: BlankObject, key: string[]): any {
  // First, validate key
  // TODO

  const target = key.slice(0, -1).reduce((active, subkey) => {
    if (!active[subkey]) {
      active[subkey] = blank();
    }
    return active[subkey];
  }, object);

  const next = blank();
  target[last(key)!] = next;

  return next;
}

function ensureTableArray(object: any, key: string[]): any {
  // First, validate key
  // TODO

  const target = key.slice(0, -1).reduce((active, subkey) => {
    if (!active[subkey]) {
      active[subkey] = blank();
    }
    return active[subkey];
  }, object);

  const last_key = last(key)!;
  if (!target[last_key]) {
    target[last_key] = [];
  }

  const next = blank();
  target[last(key)!].push(next);

  return next;
}
