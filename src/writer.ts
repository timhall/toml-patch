import {
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
  NodeType,
  isComment,
  isInlineTableItem,
  isInlineArrayItem,
  isDocument
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
    if (index < 0) throw new Error(`Could not find existing item in parent node for replace`);

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
    throw new Error(`Unsupported parent type "${parent.type}" for replace`);
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
    throw new Error(`Unsupported parent type "${parent.type}" for insert`);
  }

  // Determine bracket spacing from existing before inserting child
  const is_inline = isInlineArray(parent) || isInlineTable(parent);
  let bracket_spacing = 0;
  if (is_inline && parent.items.length) {
    // TODO this doesn't take into account any offsets waiting to be applied
    // const leading_spacing = parent.items[0].loc.start.column - (parent.loc.start.column + 1);
    // const trailing_spacing = parent.loc.end.column - 1 - last(parent.items)!.loc.end.column;
    // bracket_spacing = Math.min(leading_spacing, trailing_spacing);
  }

  // Store preceding node and insert
  const previous = index != null ? parent.items[index - 1] : last(parent.items);
  const is_first = !previous;
  const is_last = index == null || index === parent.items.length;

  if (index != null) {
    parent.items.splice(index, 0, child);
  } else {
    parent.items.push(child);
  }

  // Add commas as-needed
  const leading_comma = is_inline && previous;
  const has_trailing_items = index != null && parent.items.length >= index + 1;
  const trailing_comma = is_inline && has_trailing_items;
  if (leading_comma) {
    (previous as InlineArrayItem | InlineTableItem).comma = true;
  }
  if (trailing_comma) {
    (child as InlineArrayItem | InlineTableItem).comma = true;
  }

  // Use a new line for documents, children of Table/TableArray,
  // and if an inline table is using new lines
  const use_new_line =
    isDocument(parent) ||
    isTable(parent) ||
    isTableArray(parent) ||
    (isInlineArray(parent) && perLine(parent));

  // Set start location from previous item or start of array
  // (previous is undefined for empty array or inserting at first item)
  const start = previous
    ? {
        line: previous.loc.end.line,
        column: use_new_line
          ? !isComment(previous)
            ? previous.loc.start.column
            : parent.loc.start.column
          : previous.loc.end.column
      }
    : clonePosition(parent.loc.start);

  const is_block = isTable(child) || isTableArray(child);
  let leading_lines = 0;
  if (is_block) {
    leading_lines = 2;
  } else if (use_new_line) {
    leading_lines = 1;
  } else if (is_inline) {
    const skip_comma = 2;
    const skip_bracket = 1;
    start.column += leading_comma ? skip_comma : skip_bracket + bracket_spacing;
  }
  start.line += leading_lines;

  const shift = {
    lines: start.line - child.loc.start.line,
    columns: start.column - child.loc.start.column
  };

  shiftNode(child, shift);

  // Apply offsets after child node
  const child_span = getSpan(child.loc);
  const offset = {
    lines: child_span.lines + (leading_lines - 1),
    columns:
      child_span.columns +
      (leading_comma || trailing_comma ? 2 : 0) +
      (is_first || is_last ? bracket_spacing : 0)
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
  // Remove an element from the parent's items
  // (supports Document, Table, TableArray, InlineTable, and InlineArray
  //
  //      X
  // [ 1, 2, 3 ]
  //    ^-^
  // -> Remove element 2 and apply 0,-3 offset to 1
  //
  // [table]
  // a = 1
  // b = 2 # X
  // c = 3
  // -> Remove element 2 and apply -1,0 offset to 1
  if (!hasItems(parent)) {
    throw new Error(`Unsupported parent type "${parent.type}" for remove`);
  }

  let index = parent.items.indexOf(node);
  if (index < 0) {
    // Try again, looking at child items for nodes like InlineArrayItem
    index = parent.items.findIndex(item => hasItem(item) && item.item === node);

    if (index < 0) {
      throw new Error('Could not find node in parent for removal');
    }

    node = parent.items[index];
  }

  const previous = parent.items[index - 1];
  let next = parent.items[index + 1];

  // Remove node
  parent.items.splice(index, 1);
  let removed_span = getSpan(node.loc);

  // Remove an associated comment that appears on the same line
  //
  // [table]
  // a = 1
  // b = 2 # remove this too
  // c = 3
  //
  // TODO InlineTable - this only applies to comments in Table/TableArray
  if (next && isComment(next) && next.loc.start.line === node.loc.end.line) {
    // Add comment to removed
    removed_span = getSpan({ start: node.loc.start, end: next.loc.end });

    // Shift to next item
    // (use same index since node has already been removed)
    next = parent.items[index + 1];

    // Remove comment
    parent.items.splice(index, 1);
  }

  // For inline tables and arrays, check whether the line should be kept
  const is_inline = isInlineArrayItem(previous) || isInlineTableItem(previous);
  const previous_on_same_line = previous && previous.loc.end.line === node.loc.start.line;
  const next_on_sameLine = next && next.loc.start.line === node.loc.end.line;
  const keep_line = is_inline && (previous_on_same_line || next_on_sameLine);

  const offset = {
    lines: -(removed_span.lines - (keep_line ? 1 : 0)),
    columns: -removed_span.columns
  };

  // Offset for comma and remove comma from previous (if-needed)
  if (is_inline && previous_on_same_line) {
    offset.columns -= 2;
  }
  if (is_inline && previous && !next) {
    (previous as InlineArrayItem | InlineTableItem).comma = false;
  }

  // Apply offsets after preceding node or before children of parent node
  const target = previous || parent;
  const offsets = getExit(root);
  const previous_offset = offsets.get(target);
  if (previous_offset) {
    offset.lines += previous_offset.lines;
    offset.columns += previous_offset.columns;
  }
  const removed_offset = offsets.get(node);
  if (removed_offset) {
    offset.lines += removed_offset.lines;
    offset.columns += removed_offset.columns;
  }

  offsets.set(target, offset);
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
        const key_offset = exit.get(node.key);
        node.equals += (offset.columns[start_line] || 0) + (key_offset ? key_offset.columns : 0);

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
