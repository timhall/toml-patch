import {
  AST,
  Node,
  isKeyValue,
  isTable,
  isTableArray,
  isInlineTable,
  isInlineArray,
  hasItems,
  hasItem,
  Key,
  Value,
  InlineArray,
  InlineArrayItem,
  InlineTableItem,
  NodeType
} from './ast';
import { Span, getSpan, clonePosition } from './location';
import { last } from './utils';
import traverse from './traverse';

// Store line and column offsets per node
//
// Some offsets are applied on enter (e.g. shift child items and next items)
// Others are applied on exit (e.g. shift next items)
type Offsets = WeakMap<Node, Span>;

const enter_offsets: WeakMap<AST, Offsets> = new WeakMap();
const getEnter = (ast: AST) => {
  if (!enter_offsets.has(ast)) {
    enter_offsets.set(ast, new WeakMap());
  }
  return enter_offsets.get(ast)!;
};

const exit_offsets: WeakMap<AST, Offsets> = new WeakMap();
const getExit = (ast: AST) => {
  if (!exit_offsets.has(ast)) {
    exit_offsets.set(ast, new WeakMap());
  }
  return exit_offsets.get(ast)!;
};

export function replace(ast: AST, parent: Node, existing: Node, replacement: Node) {
  // First, replace existing node
  // (by index for items, item, or key/value)
  if (hasItems(parent)) {
    const index = parent.items.indexOf(existing);
    if (index < 0) throw new Error(`Could not find existing item in parent node`);

    parent.items.splice(index, 1, replacement);
  } else if (hasItem(parent)) {
    parent.item = replacement;
  } else if (isKeyValue(parent)) {
    if (parent.key === existing) {
      parent.key = replacement as Key;
    } else {
      parent.value = replacement as Value;
    }
  } else {
    throw new Error(`Unsupported parent type "${parent.type}" for replace.`);
  }

  // Shift the replacement node into the same start position as existing
  const shift = {
    lines: replacement.loc.start.line - existing.loc.start.line,
    columns: replacement.loc.start.column - existing.loc.start.column
  };
  shiftNode(replacement, shift);

  // Apply offsets after replacement node
  const existing_span = getSpan(existing.loc);
  const replacement_span = getSpan(replacement.loc);
  const offset = {
    lines: replacement_span.lines - existing_span.lines,
    columns: replacement_span.columns - existing_span.columns
  };

  const offsets = getExit(ast);
  offsets.set(replacement, offset);
}

export function insert(ast: AST, parent: Node, child: Node, index?: number) {
  if (!hasItems(parent)) {
    throw new Error(`Unsupported parent type "${parent.type}" for replace.`);
  }

  // Store preceding node and insert
  const previous = index != null ? parent.items[index - 1] : last(parent.items);

  if (index != null) {
    parent.items.splice(index, 0, child);
  } else {
    parent.items.push(child);
  }

  // Add commas as-needed
  const is_inline = isInlineArray(parent) || isInlineTable(parent);
  if (previous && is_inline) {
    (previous as InlineArrayItem | InlineTableItem).comma = true;
  }
  if (index != null && parent.items.length >= index + 1 && is_inline) {
    (child as InlineArrayItem | InlineTableItem).comma = true;
  }

  // Set start location from previous item or start of array
  // (previous is undefined for empty array or inserting at first item)
  const use_new_line =
    isTable(parent) || isTableArray(parent) || (isInlineArray(parent) && perLine(parent));

  const start = previous
    ? {
        line: previous.loc.start.line,
        column: use_new_line ? previous.loc.start.column : previous.loc.end.column
      }
    : parent.loc.start;

  if (use_new_line) {
    child.loc.start.line += 1;
  } else {
    child.loc.start.column += previous ? 2 : 1;
  }

  const shift = {
    lines: child.loc.start.line - start.line,
    columns: child.loc.start.column - start.column
  };

  shiftNode(child, shift);

  // Apply offsets after child node
  const child_span = getSpan(child.loc);
  const offset = {
    lines: child_span.lines - (use_new_line ? 0 : 1),
    columns: child_span.columns
  };

  const offsets = getExit(ast);
  offsets.set(child, offset);
}

export function remove(ast: AST, parent: Node, node: Node) {
  if (!hasItems(parent)) {
    throw new Error(`Unsupported parent type "${parent.type}" for remove.`);
  }

  const index = parent.items.indexOf(node);
  if (index < 0) {
    throw new Error('Could not find node in parent for removal');
  }

  const previous = parent.items[index - 1];
  const next = parent.items[index + 1];
  parent.items.splice(index, 1);

  // Apply offsets after preceding node or before children of parent node
  const removed_span = getSpan(node.loc);
  const keep_line =
    (previous && previous.loc.end.line === node.loc.start.line) ||
    (next && next.loc.start.line === node.loc.end.line);

  const offset = {
    lines: removed_span.lines - (keep_line ? 1 : 0),
    columns: removed_span.columns
  };

  if (previous) {
    const offsets = getExit(ast);
    offsets.set(previous, offset);
  } else {
    const offsets = getEnter(ast);
    offsets.set(parent, offset);
  }
}

export function applyWrites(ast: AST) {
  const enter = getEnter(ast);
  const exit = getExit(ast);

  const offset: { lines: number; columns: { [index: number]: number } } = {
    lines: 0,
    columns: {}
  };

  function shiftStart(node: Node) {
    node.loc.start.line += offset.lines;
    node.loc.start.column += offset.columns[node.loc.start.line] || 0;

    const entering = enter.get(node);
    if (entering) {
      offset.lines += entering.lines;
      offset.columns[node.loc.start.line] =
        (offset.columns[node.loc.start.line] || 0) + entering.columns;
    }
  }
  function shiftEnd(node: Node) {
    node.loc.end.line += offset.lines;
    node.loc.end.column += offset.columns[node.loc.end.line] || 0;

    const exiting = exit.get(node);
    if (exiting) {
      offset.lines += exiting.lines;
      offset.columns[node.loc.end.line] =
        (offset.columns[node.loc.end.line] || 0) + exiting.columns;
    }
  }
  const shiftLocation = {
    enter: shiftStart,
    exit: shiftEnd
  };

  traverse(ast, {
    [NodeType.Document]: shiftLocation,
    [NodeType.Table]: shiftLocation,
    [NodeType.TableArray]: shiftLocation,
    [NodeType.InlineTable]: shiftLocation,
    [NodeType.InlineArray]: shiftLocation,

    [NodeType.InlineArrayItem]: shiftLocation,
    [NodeType.InlineTableItem]: shiftLocation,
    [NodeType.TableKey]: shiftLocation,
    [NodeType.TableArrayKey]: shiftLocation,

    [NodeType.KeyValue]: {
      enter(node) {
        const start_line = node.loc.start.line + offset.lines;
        node.equals += offset.columns[start_line] || 0;

        shiftStart(node);
      },
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
}

export function shiftNode(node: Node, span: Span): Node {
  const { lines, columns } = span;
  const move = (node: Node) => {
    node.loc.start.column += columns;
    node.loc.end.column += columns;
    node.loc.start.line += lines;
    node.loc.end.line += lines;
  };

  traverse(node, {
    [NodeType.Table]: move,
    [NodeType.TableKey]: move,
    [NodeType.TableArray]: move,
    [NodeType.TableArrayKey]: move,
    [NodeType.KeyValue](node) {
      move(node);
      node.equals += columns;
    },
    [NodeType.Key]: move,
    [NodeType.String]: move,
    [NodeType.Integer]: move,
    [NodeType.Float]: move,
    [NodeType.Boolean]: move,
    [NodeType.DateTime]: move,
    [NodeType.InlineArray]: move,
    [NodeType.InlineArrayItem]: move,
    [NodeType.InlineTable]: move,
    [NodeType.InlineTableItem]: move,
    [NodeType.Comment]: move
  });

  return node;
}

function perLine(array: InlineArray): boolean {
  if (!array.items.length) return false;

  const span = getSpan(array.loc);
  return span.lines > array.items.length;
}
