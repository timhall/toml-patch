import {
  Node,
  isKeyValue,
  isTable,
  isTableArray,
  hasItems,
  isInlineTableItem,
  isInlineArrayItem,
  hasItem
} from './ast';
import { arraysEqual, stableStringify } from './utils';

export type Path = Array<string | number>;

export default function findByPath(node: Node, path: Path): Node {
  if (!path.length) {
    if (hasItem(node)) {
      return node.item;
    } else {
      return node;
    }
  }
  if (isKeyValue(node)) {
    return findByPath(node.value, path);
  }

  const indexes: { [key: string]: number } = {};
  let found;
  if (hasItems(node)) {
    node.items.some((item, index) => {
      try {
        let key: Path = [];
        if (isKeyValue(item)) {
          key = item.key.value;
        } else if (isTable(item)) {
          key = item.key.item.value;
        } else if (isTableArray(item)) {
          key = item.key.item.value;

          const key_string = stableStringify(key);
          if (!indexes[key_string]) {
            indexes[key_string] = 0;
          }
          const array_index = indexes[key_string]++;

          key = key.concat(array_index);
        } else if (isInlineTableItem(item)) {
          key = item.item.key.value;
        } else if (isInlineArrayItem(item)) {
          key = [index];
        }

        if (key.length && arraysEqual(key, path.slice(0, key.length))) {
          found = findByPath(item, path.slice(key.length));
          return true;
        } else {
          return false;
        }
      } catch (err) {
        return false;
      }
    });
  }

  if (!found) {
    throw new Error(`Could not find node at path ${path.join('.')}`);
  }

  return found;
}

export function tryFindByPath(node: Node, path: Path): Node | undefined {
  try {
    return findByPath(node, path);
  } catch (err) {}
}

export function findParent(node: Node, path: Path): Node {
  let parent_path = path;
  let parent;
  while (parent_path.length && !parent) {
    parent_path = parent_path.slice(0, -1);
    parent = tryFindByPath(node, parent_path);
  }

  if (!parent) {
    throw new Error(`Count not find parent node for path ${path.join('.')}`);
  }

  return parent;
}
