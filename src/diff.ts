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
  if (before === after) {
    return [];
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    return compareArrays(before, after, path);
  } else if (isDate(before) && isDate(after)) {
    if ((before as Date).toISOString() !== (after as Date).toISOString()) {
      return [
        {
          type: ChangeType.Edit,
          path,
          before,
          after
        }
      ];
    } else {
      return [];
    }
  } else if (!isObject(before) || !isObject(after)) {
    return [
      {
        type: ChangeType.Edit,
        path,
        before,
        after
      }
    ];
  } else {
    return compareObjects(before, after, path);
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
  const before_indexes: { [item: string]: number[] } = {};
  const changes: Change[] = [];

  before.forEach((item, index) => {
    const item_as_string = stableStringify(item);
    if (!before_indexes[item_as_string]) {
      before_indexes[item_as_string] = [];
    }
    before_indexes[stableStringify(item)].push(index);
  });

  after.forEach((item, index) => {
    const item_as_string = stableStringify(item);
    const previous_index = before_indexes[item_as_string] && before_indexes[item_as_string].shift();

    if (previous_index == null) {
      changes.push({
        type: ChangeType.Add,
        path: path.concat(index),
        item
      });
    } else {
      if (previous_index !== index) {
        changes.push({
          type: ChangeType.Move,
          path,
          from: previous_index,
          to: index
        });
      }
    }
  });

  Object.keys(before_indexes).forEach(item => {
    before_indexes[item].forEach(index => {
      changes.push({
        type: ChangeType.Remove,
        path: path.concat(index)
      });
    });
  });

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
