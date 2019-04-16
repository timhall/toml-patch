import parseTOML from './parse-toml';
import parseJS from './parse-js';
import toJS from './to-js';
import toTOML from './to-toml';
import { Format } from './format';
import {
  AST,
  Node,
  NodeType,
  KeyValue,
  InlineTableItem,
  Value,
  InlineArrayItem,
  InlineArray,
  Document,
  TableArray,
  isKeyValue
} from './ast';
import diff, { Change, ChangeType } from './diff';
import traverse from './traverse';
import findByPath from './find-by-path';
import { Location, clonePosition } from './location';
import { Position } from 'estree';
import { last } from './utils';

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

  // Map changes to the nodes that they apply to
  const search: Map<Node, Change[]> = new Map();
  changes.forEach(change => {
    const path =
      change.type === ChangeType.Add || change.type === ChangeType.Remove
        ? change.path.slice(0, -1)
        : change.path;
    let node = findByPath(original, path);

    // For key-values, point to value for Add, Remove, and Move
    if (
      isKeyValue(node) &&
      (change.type === ChangeType.Add ||
        change.type === ChangeType.Remove ||
        change.type === ChangeType.Move)
    ) {
      node = (node as KeyValue).value;
    }

    if (!search.has(node)) {
      search.set(node, []);
    }
    search.get(node)!.push(change);
  });

  const added: WeakMap<Node, Span> = new WeakMap();
  const removed: WeakMap<Node, Span> = new WeakMap();
  const offset: { line: number; column: { [line: number]: number } } = {
    line: 0,
    column: {}
  };
  const shiftPosition = (position: Position): Position => {
    const line = position.line + offset.line;
    return {
      line,
      column: position.column + (offset.column[line] || 0)
    };
  };
  const shiftLocation = (node: Node) => {
    node.loc = { start: shiftPosition(node.loc.start), end: shiftPosition(node.loc.end) };
  };
  const shiftStart = (node: Node) => {
    node.loc.start = shiftPosition(node.loc.start);
  };
  const shiftEnd = (node: Node) => {
    node.loc.end = shiftPosition(node.loc.end);

    if (added.has(node)) {
      const span = added.get(node)!;
      offset.line += span.lines;
      offset.column[node.loc.end.line] = span.columns;
    } else if (removed.has(node)) {
      const span = removed.get(node)!;
      offset.line -= span.lines;
      offset.column[node.loc.end.line] = -span.columns;
    }
  };

  traverse(original, {
    // For nodes with children, need to update the start separately from the end
    // in case a child has changed offsets internally

    [NodeType.Document]: {
      enter(node) {
        const changes = search.get(node) || [];
        changes.forEach(change => {
          if (change.type === ChangeType.Add) {
            // TODO Add KeyValue, Table, or TableArray
          } else if (change.type === ChangeType.Remove) {
            // TODO
          } else if (change.type === ChangeType.Move) {
            // TODO Move TableArray
          } else {
            throw new Error(`Unsupported change "${change.type}" on Document`);
          }
        });
      },
      exit: shiftEnd
    },

    [NodeType.Table]: {
      enter(node) {
        const changes = search.get(node) || [];
        changes.forEach(change => {
          if (change.type === ChangeType.Add) {
            const addition = findByPath(updated, change.path) as KeyValue;

            // Position replacement based on current locations
            const span = getSpan(addition.loc);
            const previous = last(node.items);
            const start: Position = {
              line: node.loc.end.line + 1,
              column: previous ? previous.loc.start.column : node.loc.start.column
            };
            addition.loc = {
              start,
              end: { line: start.line + span.lines, column: start.column + span.columns }
            };

            node.items.push(addition);
            added.set(addition, span);
          } else if (change.type === ChangeType.Remove) {
            // Mark node for removal on exit
            const removal = findByPath(original, change.path) as KeyValue;
            const span = getSpan(removal.loc);

            removed.set(removal, span);
          } else {
            throw new Error(`Unsupported change "${change.type}" on table`);
          }
        });

        shiftStart(node);
      },
      exit(node) {
        node.items = node.items.filter(node => {
          return !removed.has(node);
        });

        shiftEnd(node);
      }
    },
    [NodeType.InlineTable]: {
      enter(node) {
        const changes = search.get(node) || [];
        changes.forEach(change => {
          if (change.type === ChangeType.Add) {
            const addition = findByPath(updated, change.path) as InlineTableItem;

            // Position replacement based on current locations
            const span = getSpan(addition.loc);
            const previous = last(node.items);
            const start: Position = {
              line: node.loc.start.line,
              column: previous ? previous.loc.end.column + 2 : node.loc.end.column
            };
            addition.loc = {
              start,
              end: { line: start.line, column: start.column = span.columns }
            };

            if (previous) previous.comma = true;
            node.items.push(addition);

            // TODO should only add columns (rows = 0 always)
            added.set(addition, span);
          } else if (change.type === ChangeType.Remove) {
            const removal = findByPath(original, change.path) as InlineTableItem;
            const span = getSpan(removal.loc);

            // TODO should only remove columns (rows = 0 always)
            removed.set(removal, span);
          } else {
            throw new Error(`Unsupported change "${change.type}" on inline-table`);
          }
        });

        shiftStart(node);
      },
      exit(node) {
        node.items = node.items.filter(node => {
          return !removed.has(node);
        });

        shiftEnd(node);
      }
    },

    [NodeType.TableArray]: {
      enter(node) {
        const changes = search.get(node) || [];
        changes.forEach(change => {
          if (change.type === ChangeType.Add) {
            const addition = findByPath(updated, change.path) as KeyValue;

            const span = getSpan(addition.loc);
            const previous = last(node.items);
            const start: Position = {
              line: node.loc.end.line,
              column: previous ? previous.loc.start.column : node.loc.start.column
            };
            addition.loc = {
              start,
              end: { line: start.line + span.lines, column: start.column + span.columns }
            };

            node.items.push(addition);
            added.set(node, span);
          } else if (change.type === ChangeType.Remove) {
            const removal = findByPath(original, change.path) as KeyValue;
            const span = getSpan(removal.loc);

            removed.set(node, span);
          } else {
            throw new Error(`Unsupported change "${change.type}" on table-array`);
          }
        });

        shiftStart(node);
      },
      exit(node) {
        node.items = node.items.filter(node => {
          return !removed.has(node);
        });

        shiftEnd(node);
      }
    },
    [NodeType.InlineArray]: {
      enter(node) {
        const changes = search.get(node) || [];
        changes.forEach(change => {
          if (change.type === ChangeType.Add) {
            const index = last(change.path)! as number;
            const addition = findByPath(updated, change.path) as InlineArrayItem;

            const span = getSpan(addition.loc);
            const previous = last(node.items);
            const start: Position = {
              line: previous ? previous.loc.end.line : node.loc.end.line,
              column: previous ? previous.loc.end.column + 2 : node.loc.end.column
            };
            addition.loc = {
              start,
              end: { line: start.line + span.lines, column: start.column + span.columns }
            };

            if (previous) previous.comma = true;
            node.items.splice(index, 0, addition);

            // TODO investigate span here
            // Potential heuristics: one-per-line -> continue pattern
            // otherwise, append to line of previous element
            added.set(node, span);
          } else if (change.type === ChangeType.Remove) {
            const index = last(change.path)! as number;
            const removal = node.items[index];
            const span = getSpan(removal.loc);

            // TODO span needs to account for layout
            // Only element on line -> remove line
            // Shares line -> remove column only (no lines)
            removed.set(node, span);
          } else if (change.type === ChangeType.Move) {
            // For Move, consider as addition and mark element previous to moved
            // as removed with moved's info to apply after that element
            const moved = node.items[change.from];
            const marked = node.items[change.from - 1];
            const previous = node.items[change.to - 1];
            const span = getSpan(moved.loc);
            const start: Position = {
              line: previous ? previous.loc.end.line : node.loc.end.line,
              column: previous ? previous.loc.end.column + 2 : node.loc.end.column
            };
            moved.loc = {
              start,
              end: { line: start.line + span.lines, column: start.column + span.columns }
            };

            // Perform move
            node.items.splice(change.from, 1);
            node.items.splice(change.to, 0, moved);

            // TODO These spans need heuristics like above and validation
            added.set(node, span);
            removed.set(marked!, span);
          } else {
            throw new Error(`Unsupported change "${change.type}" on inline-array`);
          }
        });

        shiftStart(node);
      },
      exit(node) {
        node.items = node.items.filter(node => {
          return !removed.has(node);
        });

        shiftEnd(node);
      }
    },

    [NodeType.KeyValue]: {
      enter(node) {
        const changes = search.get(node) || [];
        let equals_shift = 0;
        changes.forEach(change => {
          if (change.type === ChangeType.Edit) {
            const replacement = findByPath(updated, change.path) as KeyValue;
            const { start, end: original_end } = node.value.loc;
            const span = getSpan(replacement.value.loc);

            node.value = replacement.value;
            node.value.loc = {
              start,
              end: { line: start.line + span.lines, column: start.column + span.columns }
            };

            added.set(node.value, {
              lines: node.value.loc.end.line - original_end.line,
              columns: node.value.loc.end.column - original_end.column
            });
          } else if (change.type === ChangeType.Rename) {
            const base = change.path.slice(0, -1);
            const replacement = findByPath(updated, base.concat(change.to)) as KeyValue;
            const { start, end: original_end } = node.key.loc;
            const span = getSpan(replacement.key.loc);

            node.key = replacement.key;
            node.key.loc = {
              start,
              end: { line: start.line + span.lines, column: start.column + span.columns }
            };

            const lines = node.key.loc.end.line - original_end.line;
            const columns = node.key.loc.end.column - original_end.column;

            equals_shift = columns;
            added.set(node.key, {
              lines,
              columns
            });
          } else {
            throw new Error(`Unsupported change "${change.type}" on key-value`);
          }
        });

        shiftStart(node);
        node.equals += (offset.column[node.loc.start.line] || 0) + equals_shift;
      },
      exit: shiftEnd
    },
    [NodeType.InlineArrayItem]: {
      enter(node) {
        const changes = search.get(node) || [];
        changes.forEach(change => {
          if (change.type === ChangeType.Edit) {
            const replacement = findByPath(updated, change.path) as InlineArrayItem;
            const { start, end: original_end } = node.loc;
            const span = getSpan(replacement.loc);

            node.item = replacement.item;
            node.loc = {
              start,
              end: { line: start.line + span.lines, column: start.column + span.columns }
            };

            added.set(node, {
              lines: node.loc.end.line - original_end.line,
              columns: node.loc.end.column - original_end.column
            });
          } else {
            throw new Error(`Unsupported change "${change.type}" on inline-array-item`);
          }
        });

        shiftStart(node);
      },
      exit: shiftEnd
    },

    [NodeType.InlineTableItem]: {
      enter: shiftStart,
      exit: shiftEnd
    },
    [NodeType.TableKey]: {
      enter: shiftStart,
      exit: shiftEnd
    },
    [NodeType.TableArrayKey]: {
      enter: shiftStart,
      exit: shiftEnd
    },

    [NodeType.Key]: shiftLocation,
    [NodeType.String]: shiftLocation,
    [NodeType.Integer]: shiftLocation,
    [NodeType.Float]: shiftLocation,
    [NodeType.Boolean]: shiftLocation,
    [NodeType.DateTime]: shiftLocation,
    [NodeType.Comment]: shiftLocation
  });

  return original;
}

interface Span {
  lines: number;
  columns: number;
}

function getSpan(location: Location): Span {
  return {
    lines: location.end.line - location.start.line,
    columns: location.end.column - location.start.column
  };
}
