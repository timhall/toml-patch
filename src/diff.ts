import { isObject, isDate } from './utils';

export enum ChangeType {
  Add = 'Add',
  Edit = 'Edit',
  Remove = 'Remove',
  Move = 'Move'
}

export type Path = Array<string | number>;

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
  // To properly maintain indexes during operations:
  // 1. Remove
  // 2. Move
  // 3. Add
  type Indexes = { [item: string]: number[] };
  const before_indexes: Indexes = {};
  const after_indexes: Indexes = {};

  // 0. Load indexes for items in arrays
  // (use stable stringify to create keys)
  before.forEach((item, index) => {
    const item_as_string = stableStringify(item);
    if (!before_indexes[item_as_string]) {
      before_indexes[item_as_string] = [];
    }
    before_indexes[item_as_string].push(index);
  });
  const after_items = after.map((item, index) => {
    const item_as_string = stableStringify(item);
    if (!after_indexes[item_as_string]) {
      after_indexes[item_as_string] = [];
    }
    after_indexes[item_as_string].push(index);

    return [item, item_as_string];
  });

  // 1. Find items that have before indexes, but no after
  const removes: Remove[] = [];
  Object.keys(before_indexes).forEach(item_as_string => {
    before_indexes[item_as_string] = before_indexes[item_as_string].filter((index, i) => {
      if (!after_indexes[item_as_string] || after_indexes[item_as_string][i] == null) {
        removes.push({
          type: ChangeType.Remove,
          path: path.concat(index)
        });

        return false;
      }

      return true;
    });
  });

  // 2. Find moved items
  // 3. Find added items
  //
  // Note: store added offset to move items to proper positions
  let added_offset = 0;
  let moves: Move[] = [];
  let adds: Add[] = [];
  after_items.forEach(([item, item_as_string], index) => {
    const previous_index = before_indexes[item_as_string] && before_indexes[item_as_string].shift();

    if (previous_index == null) {
      adds.push({
        type: ChangeType.Add,
        path: path.concat(index),
        item
      });
      added_offset += 1;
    } else {
      if (previous_index !== index - added_offset) {
        moves.push({
          type: ChangeType.Move,
          path,
          from: previous_index,
          to: index - added_offset
        });
      }
    }
  });

  return (removes as Change[]).concat(moves).concat(adds);
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

function datesEqual(a: any, b: any): boolean {
  return isDate(a) && isDate(b) && a.toISOString() === b.toISOString();
}
