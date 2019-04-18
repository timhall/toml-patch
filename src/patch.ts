import parseTOML from './parse-toml';
import parseJS from './parse-js';
import toJS from './to-js';
import toTOML from './to-toml';
import { Format } from './format';
import {
  AST,
  isTableArray,
  isInlineArray,
  isKeyValue,
  WithItems,
  KeyValue,
  isTable,
  Node,
  Document,
  isDocument,
  Table,
  TableArray,
  Block
} from './ast';
import diff, { Change, isAdd, isEdit, isRemove, isMove, isRename } from './diff';
import findByPath, { tryFindByPath } from './find-by-path';
import { last, arraysEqual, isInteger } from './utils';
import { insert, replace, remove, applyWrites } from './writer';

export default function patch(existing: string, updated: any, format?: Format): string {
  const existing_ast = parseTOML(existing);
  const existing_js = toJS(existing_ast);
  const updated_ast = parseJS(updated, format);

  const changes = diff(existing_js, updated);
  const patched_ast = applyChanges(existing_ast, updated_ast, changes);

  return toTOML(patched_ast);
}

function applyChanges(original: AST, updated: AST, changes: Change[]): AST {
  // Potential Changes:
  //
  // Add: Add key-value to object, add item to array
  // Edit: Change in value
  // Remove: Remove key-value from object, remove item from array
  // Move: Move item in array
  // Rename: Rename key in key-value
  //
  // Special consideration, inline comments need to move as-needed

  changes.forEach(change => {
    if (isAdd(change)) {
      const child = findByPath(updated, change.path);
      const parent_path = change.path.slice(0, -1);
      let index = last(change.path)! as number;

      let is_table_array = isTableArray(child);
      if (isInteger(index) && !parent_path.some(isInteger)) {
        const sibling = tryFindByPath(original, parent_path.concat(0));
        if (sibling && isTableArray(sibling)) {
          is_table_array = true;
        }
      }

      let parent: Node;
      if (isTable(child)) {
        parent = original;
      } else if (is_table_array) {
        parent = original;

        // The index needs to be updated to top-level items
        // to properly account for other items, comments, and nesting
        const document = original as Document;
        const before = tryFindByPath(document, parent_path.concat(index - 1)) as Block | undefined;
        const after = tryFindByPath(document, parent_path.concat(index)) as Block | undefined;
        if (after) {
          index = document.items.indexOf(after);
        } else if (before) {
          index = document.items.indexOf(before) + 1;
        } else {
          index = document.items.length;
        }
      } else {
        parent = findByPath(original, change.path.slice(0, -1));
        if (isKeyValue(parent)) parent = parent.value;
      }

      if (isTableArray(parent) || isInlineArray(parent) || isDocument(parent)) {
        insert(original, parent, child, index);
      } else {
        insert(original, parent, child);
      }
    } else if (isEdit(change)) {
      const parent = findByPath(original, change.path.slice(0, -1));
      const existing = findByPath(original, change.path);
      const replacement = findByPath(updated, change.path);

      replace(original, parent, existing, replacement);
    } else if (isRemove(change)) {
      let parent = findByPath(original, change.path.slice(0, -1));
      if (isKeyValue(parent)) parent = parent.value;

      const node = findByPath(original, change.path);

      remove(original, parent, node);
    } else if (isMove(change)) {
      let parent = findByPath(original, change.path);
      if (isKeyValue(parent)) parent = parent.value;

      const node = (parent as WithItems).items[change.from];

      remove(original, parent, node);
      insert(original, parent, node, change.to);
    } else if (isRename(change)) {
      const parent = findByPath(original, change.path.concat(change.from)) as KeyValue;
      const replacement = findByPath(updated, change.path.concat(change.to)) as KeyValue;

      replace(original, parent, parent.key, replacement.key);
    }
  });

  applyWrites(original);
  return original;
}
