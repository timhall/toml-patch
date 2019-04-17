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

const enter_offsets: WeakMap<Node, Offsets> = new WeakMap();
const getEnter = (root: Node) => {
  if (!enter_offsets.has(root)) {
    enter_offsets.set(root, new WeakMap());
  }
  return enter_offsets.get(root)!;
};

const exit_offsets: WeakMap<Node, Offsets> = new WeakMap();
const getExit = (root: Node) => {
  if (!exit_offsets.has(root)) {
    exit_offsets.set(root, new WeakMap());
  }
  return exit_offsets.get(root)!;
};

export function replace(root: Node, parent: Node, existing: Node, replacement: Node) {
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
    lines: existing.loc.start.line - replacement.loc.start.line,
    columns: existing.loc.start.column - replacement.loc.start.column
  };
  shiftNode(replacement, shift);

  // Apply offsets after replacement node
  const existing_span = getSpan(existing.loc);
  const replacement_span = getSpan(replacement.loc);
  const offset = {
    lines: replacement_span.lines - existing_span.lines,
    columns: replacement_span.columns - existing_span.columns
  };

  const offsets = getExit(root);
  const existing_offsets = offsets.get(existing);
  if (existing_offsets) {
    offset.lines += existing_offsets.lines;
    offset.columns += existing_offsets.columns;
  }

  offsets.set(replacement, offset);
}

export function insert(root: Node, parent: Node, child: Node, index?: number) {
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
  if (is_inline && previous) {
    (previous as InlineArrayItem | InlineTableItem).comma = true;
  }
  if (is_inline && index != null && parent.items.length >= index + 1) {
    (child as InlineArrayItem | InlineTableItem).comma = true;
  }

  // Set start location from previous item or start of array
  // (previous is undefined for empty array or inserting at first item)
  const use_new_line =
    isTable(child) ||
    isTableArray(child) ||
    isTable(parent) ||
    isTableArray(parent) ||
    (isInlineArray(parent) && perLine(parent));

  const start = previous
    ? {
        line: previous.loc.end.line,
        column: use_new_line ? previous.loc.start.column : previous.loc.end.column
      }
    : clonePosition(parent.loc.start);

  if (isTable(child) || isTableArray(child)) {
    start.line += 2;
  } else if (use_new_line) {
    start.line += 1;
  } else {
    start.column += previous ? 2 : 1;
  }

  const shift = {
    lines: start.line - child.loc.start.line,
    columns: start.column - child.loc.start.column
  };

  shiftNode(child, shift);

  // Apply offsets after child node
  const child_span = getSpan(child.loc);
  const offset = {
    lines: child_span.lines - (use_new_line ? 0 : 1),
    columns: child_span.columns
  };

  // The child element is placed relative to the previous element,
  // if the previous element has an offset, need to position relative to that
  // -> Move previous offset to child's offset
  const previous_offset = previous && getExit(root).get(previous);
  if (previous_offset) {
    offset.lines += previous_offset.lines;
    offset.columns += previous_offset.columns;

    getExit(root).delete(previous!);
  }

  const offsets = getExit(root);
  offsets.set(child, offset);
}

export function remove(root: Node, parent: Node, node: Node) {
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
    lines: -(removed_span.lines - (keep_line ? 1 : 0)),
    columns: -removed_span.columns
  };

  if (previous) {
    const offsets = getExit(root);
    const existing = offsets.get(previous);
    if (existing) {
      offset.lines += existing.lines;
      offset.columns += existing.columns;
    }

    offsets.set(previous, offset);
  } else {
    const offsets = getEnter(root);
    const existing = offsets.get(parent);
    if (existing) {
      offset.lines += existing.lines;
      offset.columns += existing.columns;
    }

    offsets.set(parent, offset);
  }
}

export function applyWrites(root: Node) {
  const enter = getEnter(root);
  const exit = getExit(root);

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

  traverse(root, {
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
