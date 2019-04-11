import { Document, Value, NodeType, Node } from './ast';
import traverse from './traverse';
import { BlankObject, last, blank } from './utils';

export type primitive = string | number | boolean | Date;

export default function toJS(document: Document | Value): any {
  if (isValue(document)) return toValue(document);

  const result = blank();
  let active: any = result;
  let previous_active: any;
  let skip = false;

  traverse(document, {
    [NodeType.Table](node) {
      const key = node.key.value.value;
      active = ensureTable(result, key);
    },

    [NodeType.TableArray](node) {
      const key = node.key.value.value;
      active = ensureTableArray(result, key);
    },

    [NodeType.KeyValue]: {
      enter(node) {
        if (skip) return;

        const key = node.key.value;
        const value = toValue(node.value);

        const target = key.length > 1 ? ensureTable(active, key.slice(0, -1)) : active;
        target[last(key)!] = value;

        if (node.value.type === NodeType.InlineTable) {
          previous_active = active;
          active = value;
        }
      },
      exit(node) {
        if (node.value.type === NodeType.InlineTable) {
          active = previous_active;
        }
      }
    },

    [NodeType.InlineTable]: {
      enter() {
        // Handled by toValue
        skip = true;
      },
      exit() {
        skip = false;
      }
    }
  });

  return result;
}

export function toValue(node: Value): any {
  switch (node.type) {
    case NodeType.InlineTable:
      // Use a placeholder document so that items aren't filtered
      const placeholder: Document = {
        type: NodeType.Document,
        loc: node.loc,
        body: node.items.map(item => item.item)
      };

      return toJS(placeholder);

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

  const target = ensure(object, key.slice(0, -1));
  const next = blank();
  target[last(key)!] = next;

  return next;
}

function ensureTableArray(object: any, key: string[]): any {
  // First, validate key
  // TODO

  const target = ensure(object, key.slice(0, -1));
  const last_key = last(key)!;
  if (!target[last_key]) {
    target[last_key] = [];
  }

  const next = blank();
  target[last(key)!].push(next);

  return next;
}

function ensure(object: any, keys: string[]): any {
  return keys.reduce((active, subkey) => {
    if (!active[subkey]) {
      active[subkey] = blank();
    }
    return Array.isArray(active[subkey]) ? last(active[subkey]) : active[subkey];
  }, object);
}

export function isValue(node: Node): node is Value {
  return (
    node.type === NodeType.String ||
    node.type === NodeType.Integer ||
    node.type === NodeType.Float ||
    node.type === NodeType.Boolean ||
    node.type === NodeType.DateTime ||
    node.type === NodeType.InlineArray ||
    node.type === NodeType.InlineTable
  );
}
