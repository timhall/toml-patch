import parseTOML from './parse-toml';
import parseJS from './parse-js';
import toJS from './to-js';
import toTOML from './to-toml';
import { Format } from './format';
import { AST, Node, NodeType, KeyValue } from './ast';
import diff, { Change, ChangeType } from './diff';
import traverse, { findByPath } from './traverse';
import { Location } from './location';
import { Position } from 'estree';

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
    const node = findByPath(original, path);

    if (!search.has(node)) {
      search.set(node, []);
    }

    search.get(node)!.push(change);
  });

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
  };

  traverse(original, {
    // For nodes with children, need to update the start separately from the end
    // in case a child has changed offsets internally
    // and apply changes on exit so that all children have already moved

    [NodeType.Table]: {
      enter: shiftStart,
      exit(node) {
        const changes = search.get(node) || [];
        changes.forEach(change => {
          if (change.type === ChangeType.Add) {
            console.log('add', node, change);
          } else if (change.type === ChangeType.Remove) {
            console.log('remove', node, change);
          } else {
            throw new Error(`Unsupported change "${change.type} on table`);
          }
        });

        shiftEnd(node);
      }
    },
    [NodeType.InlineTable]: {
      enter: shiftStart,
      exit(node) {
        const changes = search.get(node) || [];
        changes.forEach(change => {
          if (change.type === ChangeType.Add) {
            console.log('add', node, change);
          } else if (change.type === ChangeType.Remove) {
            console.log('remove', node, change);
          } else {
            throw new Error(`Unsupported change "${change.type}" on inline-table`);
          }
        });

        shiftEnd(node);
      }
    },

    [NodeType.TableArray]: {
      enter: shiftStart,
      exit(node) {
        const changes = search.get(node) || [];
        changes.forEach(change => {
          if (change.type === ChangeType.Add) {
            console.log('add', node, change);
          } else if (change.type === ChangeType.Remove) {
            console.log('remove', node, change);
          } else if (change.type === ChangeType.Move) {
            console.log('move', node, change);
          } else {
            throw new Error(`Unsupported change "${change.type}" on table-array`);
          }
        });

        shiftEnd(node);
      }
    },
    [NodeType.InlineArray]: {
      enter: shiftStart,
      exit(node) {
        const changes = search.get(node) || [];
        changes.forEach(change => {
          if (change.type === ChangeType.Add) {
            console.log('add', node, change);
          } else if (change.type === ChangeType.Remove) {
            console.log('remove', node, change);
          } else if (change.type === ChangeType.Move) {
            console.log('move', node, change);
          } else {
            throw new Error(`Unsupported change "${change.type}" on inline-array`);
          }
        });

        shiftEnd(node);
      }
    },

    [NodeType.KeyValue]: {
      enter: shiftStart,
      exit(node) {
        const changes = search.get(node) || [];
        changes.forEach(change => {
          if (change.type === ChangeType.Edit) {
            const replacement = findByPath(updated, change.path);
            const original_loc = node.value.loc;

            node.value = (replacement as KeyValue).value;

            const { lines, columns } = getSpan(node.value.loc);
            const start = shiftPosition(original_loc.start);
            node.value.loc = {
              start,
              end: {
                line: start.line + lines,
                column: start.column + columns
              }
            };

            offset.line += node.value.loc.end.line - original_loc.end.line;
            offset.column[node.value.loc.end.line] =
              node.value.loc.end.column - original_loc.end.column;
          } else if (change.type === ChangeType.Rename) {
            console.log('rename', node, change);
          } else {
            throw new Error(`Unsupported change "${change.type}" on key-value`);
          }
        });

        shiftEnd(node);
      }
    },
    [NodeType.InlineArrayItem]: {
      enter: shiftStart,
      exit(node) {
        const changes = search.get(node) || [];
        changes.forEach(change => {
          if (change.type === ChangeType.Edit) {
            console.log('edit', node, change);
          } else {
            throw new Error(`Unsupported change "${change.type}" on inline-array-item`);
          }
        });

        shiftEnd(node);
      }
    },

    [NodeType.Document]: {
      enter: shiftStart,
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

function getSpan(location: Location): { lines: number; columns: number } {
  return {
    lines: location.end.line - location.start.line,
    columns: location.end.column - location.start.column
  };
}
