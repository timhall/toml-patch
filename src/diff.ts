import { isObject, datesEqual } from './utils';
import { Path } from './traverse';

export enum ChangeType {
  Add = 'Add',
  Edit = 'Edit',
  Remove = 'Remove',
  Move = 'Move'
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

export type Change = Add | Edit | Remove | Move;

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
  const before_keys = Object.keys(before);
  const after_keys = Object.keys(after);
  let changes: Change[] = [];

  before_keys.forEach(key => {
    const sub_path = path.concat(key);
    if (!after_keys.includes(key)) {
      changes.push({
        type: ChangeType.Remove,
        path: sub_path
      });
    } else {
      changes = changes.concat(diff(before[key], after[key], sub_path));
    }
  });
  after_keys.forEach(key => {
    if (!before_keys.includes(key)) {
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
  //
  // - Check if items are the same
  // - Check if item has been moved -> shift into place
  // - Check if item is removed -> assume it's been edited and replace
  // - Add as new item and shift existing
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
  });

  // Remove any remaining overflow items
  while (before_stable.length > after_stable.length) {
    changes.push({
      type: ChangeType.Remove,
      path: path.concat(before_stable.length - 1)
    });
    before_stable.pop();
  }

  return changes;
}

function stableStringify(object: any): string {
  if (isObject(object)) {
    const key_values = Object.keys(object)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(object[key])}`);

    return `{${key_values.join(',')}}`;
  } else if (Array.isArray(object)) {
    return `[${object.map(stableStringify).join(',')}]`;
  } else {
    return JSON.stringify(object);
  }
}
