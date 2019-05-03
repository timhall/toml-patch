import { isObject, datesEqual, stableStringify, merge } from './utils';
import { Path } from './find-by-path';

export enum ChangeType {
  Add = 'Add',
  Edit = 'Edit',
  Remove = 'Remove',
  Move = 'Move',
  Rename = 'Rename'
}

export interface Add {
  type: ChangeType.Add;
  path: Path;
}
export function isAdd(change: Change): change is Add {
  return change.type === ChangeType.Add;
}

export interface Edit {
  type: ChangeType.Edit;
  path: Path;
}
export function isEdit(change: Change): change is Edit {
  return change.type === ChangeType.Edit;
}

export interface Remove {
  type: ChangeType.Remove;
  path: Path;
}
export function isRemove(change: Change): change is Remove {
  return change.type === ChangeType.Remove;
}

export interface Move {
  type: ChangeType.Move;
  path: Path;
  from: number;
  to: number;
}
export function isMove(change: Change): change is Move {
  return change.type === ChangeType.Move;
}

export interface Rename {
  type: ChangeType.Rename;
  path: Path;
  from: string;
  to: string;
}
export function isRename(change: Change): change is Rename {
  return change.type === ChangeType.Rename;
}

export type Change = Add | Edit | Remove | Move | Rename;

export default function diff(before: any, after: any, path: Path = []): Change[] {
  if (before === after || datesEqual(before, after)) {
    return [];
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    return compareArrays(before, after, path);
  } else if (isObject(before) && isObject(after)) {
    return compareObjects(before, after, path);
  } else {
    return [
      {
        type: ChangeType.Edit,
        path
      }
    ];
  }
}

function compareObjects(before: any, after: any, path: Path = []): Change[] {
  let changes: Change[] = [];

  // 1. Get keys and stable values
  const before_keys = Object.keys(before);
  const before_stable = before_keys.map(key => stableStringify(before[key]));
  const after_keys = Object.keys(after);
  const after_stable = after_keys.map(key => stableStringify(after[key]));

  // Check for rename by seeing if object is in both before and after
  // and that key is no longer used in after
  const isRename = (stable: string, search: string[]) => {
    const index = search.indexOf(stable);
    if (index < 0) return false;

    const before_key = before_keys[before_stable.indexOf(stable)];
    return !after_keys.includes(before_key);
  };

  // 2. Check for changes, rename, and removed
  before_keys.forEach((key, index) => {
    const sub_path = path.concat(key);
    if (after_keys.includes(key)) {
      merge(changes, diff(before[key], after[key], sub_path));
    } else if (isRename(before_stable[index], after_stable)) {
      const to = after_keys[after_stable.indexOf(before_stable[index])];
      changes.push({
        type: ChangeType.Rename,
        path,
        from: key,
        to
      });
    } else {
      changes.push({
        type: ChangeType.Remove,
        path: sub_path
      });
    }
  });

  // 3. Check for additions
  after_keys.forEach((key, index) => {
    if (!before_keys.includes(key) && !isRename(after_stable[index], before_stable)) {
      changes.push({
        type: ChangeType.Add,
        path: path.concat(key)
      });
    }
  });

  return changes;
}

function compareArrays(before: any[], after: any[], path: Path = []): Change[] {
  let changes: Change[] = [];

  // 1. Convert arrays to stable objects
  const before_stable = before.map(stableStringify);
  const after_stable = after.map(stableStringify);

  // 2. Step through after array making changes to before array as-needed
  after_stable.forEach((value, index) => {
    const overflow = index >= before_stable.length;

    // Check if items are the same
    if (!overflow && before_stable[index] === value) {
      return;
    }

    // Check if item has been moved -> shift into place
    const from = before_stable.indexOf(value, index + 1);
    if (!overflow && from > -1) {
      changes.push({
        type: ChangeType.Move,
        path,
        from,
        to: index
      });

      const move = before_stable.splice(from, 1);
      before_stable.splice(index, 0, ...move);

      return;
    }

    // Check if item is removed -> assume it's been edited and replace
    const removed = !after_stable.includes(before_stable[index]);
    if (!overflow && removed) {
      merge(changes, diff(before[index], after[index], path.concat(index)));
      before_stable[index] = value;

      return;
    }

    // Add as new item and shift existing
    changes.push({
      type: ChangeType.Add,
      path: path.concat(index)
    });
    before_stable.splice(index, 0, value);
  });

  // 3. Remove any remaining overflow items
  for (let i = after_stable.length; i < before_stable.length; i++) {
    changes.push({
      type: ChangeType.Remove,
      path: path.concat(i)
    });
  }

  return changes;
}
