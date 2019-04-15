import { isObject, datesEqual, stableStringify } from './utils';
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
  item: any;
}
export interface Edit {
  type: ChangeType.Edit;
  path: Path;
  before: any;
  after: any;
}
export interface Remove {
  type: ChangeType.Remove;
  path: Path;
}
export interface Move {
  type: ChangeType.Move;
  path: Path;
  from: number;
  to: number;
}
export interface Rename {
  type: ChangeType.Rename;
  path: Path;
  to: string;
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
        path,
        before,
        after
      }
    ];
  }
}

function compareObjects(before: any, after: any, path: Path = []): Change[] {
  let changes: Change[] = [];

  const before_keys = Object.keys(before);
  const before_stable = before_keys.map(key => stableStringify(before[key]));
  const after_keys = Object.keys(after);
  const after_stable = after_keys.map(key => stableStringify(after[key]));

  const isRename = (stable: string, search: string[]) => {
    const index = search.indexOf(stable);
    if (index < 0) return false;

    const before_key = before_keys[before_stable.indexOf(stable)];
    return !after_keys.includes(before_key);
  };

  before_keys.forEach((key, index) => {
    const sub_path = path.concat(key);
    if (after_keys.includes(key)) {
      changes = changes.concat(diff(before[key], after[key], sub_path));
    } else if (isRename(before_stable[index], after_stable)) {
      const to = after_keys[after_stable.indexOf(before_stable[index])];
      changes.push({
        type: ChangeType.Rename,
        path: path.concat(key),
        to
      });
    } else {
      changes.push({
        type: ChangeType.Remove,
        path: sub_path
      });
    }
  });

  after_keys.forEach((key, index) => {
    if (!before_keys.includes(key) && !isRename(after_stable[index], before_stable)) {
      changes.push({
        type: ChangeType.Add,
        path: path.concat(key),
        item: after[key]
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
      changes = changes.concat(diff(before[index], after[index], path.concat(index)));
      before_stable[index] = value;

      return;
    }

    // Add as new item and shift existing
    changes.push({
      type: ChangeType.Add,
      path: path.concat(index),
      item: after[index]
    });
    before_stable.splice(index, 0, value);
  });

  // Remove any remaining overflow items
  for (let i = after_stable.length; i < before_stable.length; i++) {
    changes.push({
      type: ChangeType.Remove,
      path: path.concat(i)
    });
  }

  return changes;
}
