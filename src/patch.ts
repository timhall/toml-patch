import parseTOML from './parse-toml';
import parseJS from './parse-js';
import toJS from './to-js';
import toTOML from './to-toml';
import { Format } from './format';
import { AST, isTableArray, isInlineArray, isKeyValue, isInlineTable, WithItems } from './ast';
import diff, { Change, isAdd, isEdit, isRemove, isMove, isRename } from './diff';
import findByPath from './find-by-path';
import { last } from './utils';
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
      let parent = findByPath(original, change.path.slice(0, -1));
      if (isKeyValue(parent)) parent = parent.value;

      const child = findByPath(updated, change.path);
      const index = last(change.path)! as number;

      if (isTableArray(parent) || isInlineArray(parent)) {
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
      // TODO
      // const parent = findByPath(original, change.path.concat(change.from)) as KeyValue;
      // const replacement = findByPath(updated, change.path.concat(change.to)) as KeyValue;
      //
      // replace(original, parent, parent.key, replacement.key);
    }
  });

  applyWrites(original);
  return original;
}
