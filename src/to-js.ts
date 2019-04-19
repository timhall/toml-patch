import { Document, Value, NodeType, Node, AST, isInlineTable } from './ast';
import traverse from './traverse';
import { last, blank, isDate, has, arraysEqual } from './utils';
import ParseError from './parse-error';

export default function toJS(document: AST, input: string = ''): any {
  const result = blank();
  const table_arrays: Array<string[]> = [];
  let active: any = result;
  let previous_active: any;
  let skip = false;

  traverse(document, {
    [NodeType.Table](node) {
      const key = node.key.item.value;
      try {
        validateKey(result, key, node.type, { table_arrays });
      } catch (err) {
        throw new ParseError(input, node.key.loc.start, err.message);
      }

      active = ensureTable(result, key);
    },

    [NodeType.TableArray](node) {
      const key = node.key.item.value;

      try {
        validateKey(result, key, node.type, { table_arrays });
      } catch (err) {
        throw new ParseError(input, node.key.loc.start, err.message);
      }

      table_arrays.push(key);

      active = ensureTableArray(result, key);
    },

    [NodeType.KeyValue]: {
      enter(node) {
        if (skip) return;

        const key = node.key.value;
        try {
          validateKey(active, key, node.type, { table_arrays });
        } catch (err) {
          throw new ParseError(input, node.key.loc.start, err.message);
        }

        const value = toValue(node.value);
        const target = key.length > 1 ? ensureTable(active, key.slice(0, -1)) : active;

        target[last(key)!] = value;

        if (isInlineTable(node.value)) {
          previous_active = active;
          active = value;
        }
      },
      exit(node) {
        if (isInlineTable(node.value)) {
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
        items: node.items.map(item => item.item)
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

function validateKey(
  object: any,
  key: string[],
  type: NodeType.Table | NodeType.TableArray | NodeType.KeyValue,
  state: { table_arrays: Array<string[]> }
) {
  // 1. Cannot override primitive value
  let parts: string[] = [];
  let index = 0;
  for (const part of key) {
    parts.push(part);

    if (!has(object, part)) return;
    if (isPrimitive(object[part])) {
      throw new Error(`Invalid key, a value has already been defined for ${parts.join('.')}`);
    }

    const next_is_last = index++ < key.length - 1;
    object = Array.isArray(object[part]) && next_is_last ? last(object[part]) : object[part];
  }

  // 2. Cannot override table
  if (object && type === NodeType.Table) {
    throw new Error(`Invalid key, a table has already been defined named ${parts.join('.')}`);
  }

  // 3. Cannot add table array to static array or table
  if (
    object &&
    type === NodeType.TableArray &&
    !state.table_arrays.find(existing => arraysEqual(existing, key))
  ) {
    throw new Error(
      `Invalid key, cannot add an array of tables to a static array or table at ${parts.join('.')}`
    );
  }
}

function ensureTable(object: any, key: string[]): any {
  const target = ensure(object, key.slice(0, -1));
  const next = blank();
  target[last(key)!] = next;

  return next;
}

function ensureTableArray(object: any, key: string[]): any {
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

function isPrimitive(value: any) {
  return typeof value !== 'object' && !isDate(value);
}
