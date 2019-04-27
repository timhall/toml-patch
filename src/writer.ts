import {
  NodeType,
  Node,
  Document,
  Key,
  Value,
  InlineArray,
  InlineArrayItem,
  InlineTableItem,
  isKeyValue,
  isTable,
  isTableArray,
  isInlineTable,
  isInlineArray,
  hasItems,
  hasItem,
  isComment,
  isDocument,
  InlineTable,
  TableArray,
  Table,
  KeyValue,
  Comment,
  InlineItem,
  isInlineItem,
  Block,
  isBlock
} from './ast';
import { Span, getSpan, clonePosition } from './location';
import { last } from './utils';
import traverse from './traverse';

export type Root = Document | Node;

// Store line and column offsets per node
//
// Some offsets are applied on enter (e.g. shift child items and next items)
// Others are applied on exit (e.g. shift next items)
type Offsets = WeakMap<Node, Span>;

const enter_offsets: WeakMap<Root, Offsets> = new WeakMap();
const getEnter = (root: Root) => {
  if (!enter_offsets.has(root)) {
    enter_offsets.set(root, new WeakMap());
  }
  return enter_offsets.get(root)!;
};

const exit_offsets: WeakMap<Root, Offsets> = new WeakMap();
const getExit = (root: Root) => {
  if (!exit_offsets.has(root)) {
    exit_offsets.set(root, new WeakMap());
  }
  return exit_offsets.get(root)!;
};

export function replace(root: Root, parent: Node, existing: Node, replacement: Node) {
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

  addOffset(offset, getExit(root), replacement, existing);
}

export function insert(root: Root, parent: Node, child: Node, index?: number) {
  if (!hasItems(parent)) {
    throw new Error(`Unsupported parent type "${(parent as Node).type}" for insert`);
  }

  index = index != null ? index : parent.items.length;

  let shift: Span;
  let offset: Span;
  if (isInlineArray(parent) || isInlineTable(parent)) {
    ({ shift, offset } = insertInline(parent, child as InlineItem, index));
  } else {
    ({ shift, offset } = insertOnNewLine(
      parent as Document | Table | TableArray,
      child as KeyValue | Comment,
      index
    ));
  }

  shiftNode(child, shift);

  // The child element is placed relative to the previous element,
  // if the previous element has an offset, need to position relative to that
  // -> Move previous offset to child's offset
  const previous = parent.items[index - 1];
  const previous_offset = previous && getExit(root).get(previous);
  if (previous_offset) {
    offset.lines += previous_offset.lines;
    offset.columns += previous_offset.columns;

    // Account for comma overlay
    //
    // a = [b, e]
    // a = [b, c, e]
    //       ^---^
    // a = [b, c, d, e]
    //          ^---^
    if (isInlineItem(child) && previous && parent.items[index + 1]) {
      offset.columns -= 2;
    }

    getExit(root).delete(previous!);
  }

  const offsets = getExit(root);
  offsets.set(child, offset);
}

function insertOnNewLine(
  parent: Document | Table | TableArray,
  child: Block,
  index: number
): { shift: Span; offset: Span } {
  if (!isBlock(child)) {
    throw new Error(`Incompatible child type "${(child as Node).type}"`);
  }

  const previous = parent.items[index - 1];
  const use_first_line = isDocument(parent) && !parent.items.length;

  parent.items.splice(index, 0, child);

  // Set start location from previous item or start of array
  // (previous is undefined for empty array or inserting at first item)
  const start = previous
    ? {
        line: previous.loc.end.line,
        column: !isComment(previous) ? previous.loc.start.column : parent.loc.start.column
      }
    : clonePosition(parent.loc.start);

  const is_block = isTable(child) || isTableArray(child);
  let leading_lines = 0;
  if (use_first_line) {
    // 0 leading lines
  } else if (is_block) {
    leading_lines = 2;
  } else {
    leading_lines = 1;
  }
  start.line += leading_lines;

  const shift = {
    lines: start.line - child.loc.start.line,
    columns: start.column - child.loc.start.column
  };

  // Apply offsets after child node
  const child_span = getSpan(child.loc);
  const offset = {
    lines: child_span.lines + (leading_lines - 1),
    columns: child_span.columns
  };

  return { shift, offset };
}

function insertInline(
  parent: InlineArray | InlineTable,
  child: InlineItem,
  index: number
): { shift: Span; offset: Span } {
  if (!isInlineItem(child)) {
    throw new Error(`Incompatible child type "${(child as Node).type}"`);
  }

  // Store preceding node and insert
  const previous = index != null ? parent.items[index - 1] : last(parent.items);
  const is_last = index == null || index === parent.items.length;

  parent.items.splice(index, 0, child);

  // Add commas as-needed
  const leading_comma = !!previous;
  const trailing_comma = !is_last;
  const last_comma = is_last && child.comma === true;
  if (leading_comma) {
    previous!.comma = true;
  }
  if (trailing_comma) {
    child.comma = true;
  }

  // Use a new line for documents, children of Table/TableArray,
  // and if an inline table is using new lines
  const use_new_line = isInlineArray(parent) && perLine(parent);

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

  let leading_lines = 0;
  if (use_new_line) {
    leading_lines = 1;
  } else {
    const skip_comma = 2;
    const skip_bracket = 1;
    start.column += leading_comma ? skip_comma : skip_bracket;
  }
  start.line += leading_lines;

  const shift = {
    lines: start.line - child.loc.start.line,
    columns: start.column - child.loc.start.column
  };

  // Apply offsets after child node
  const child_span = getSpan(child.loc);
  const offset = {
    lines: child_span.lines + (leading_lines - 1),
    columns: child_span.columns + (leading_comma || trailing_comma ? 2 : 0) + (last_comma ? 1 : 0)
  };

  return { shift, offset };
}

export function remove(root: Root, parent: Node, node: Node) {
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
  const is_inline = previous && isInlineItem(previous);
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

export function applyBracketSpacing(
  root: Root,
  node: InlineArray | InlineTable,
  bracket_spacing: boolean = true
) {
  // Can only add bracket spacing currently
  if (!bracket_spacing) return;
  if (!node.items.length) return;

  // Apply enter to node so that items are affected
  addOffset({ lines: 0, columns: 1 }, getEnter(root), node);

  // Apply exit to last node in items
  const last_item = last(node.items as Node[])!;
  addOffset({ lines: 0, columns: 1 }, getExit(root), last_item);
}

export function applyTrailingComma(
  root: Root,
  node: InlineArray | InlineTable,
  trailing_commas: boolean = false
) {
  // Can only add trailing comma currently
  if (!trailing_commas) return;
  if (!node.items.length) return;

  const last_item = last(node.items)!;
  last_item.comma = true;

  addOffset({ lines: 0, columns: 1 }, getExit(root), last_item);
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

    [NodeType.InlineItem]: shiftLocation,
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

  enter_offsets.delete(root);
  exit_offsets.delete(root);
}

export function shiftNode(
  node: Node,
  span: Span,
  options: { first_line_only?: boolean } = {}
): Node {
  const { first_line_only = false } = options;
  const start_line = node.loc.start.line;
  const { lines, columns } = span;
  const move = (node: Node) => {
    if (!first_line_only || node.loc.start.line === start_line) {
      node.loc.start.column += columns;
      node.loc.end.column += columns;
    }
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
    [NodeType.InlineItem]: move,
    [NodeType.InlineTable]: move,
    [NodeType.Comment]: move
  });

  return node;
}

function perLine(array: InlineArray): boolean {
  if (!array.items.length) return false;

  const span = getSpan(array.loc);
  return span.lines > array.items.length;
}

function addOffset(offset: Span, offsets: Offsets, node: Node, from?: Node) {
  const previous_offset = offsets.get(from || node);
  if (previous_offset) {
    offset.lines += previous_offset.lines;
    offset.columns += previous_offset.columns;
  }

  offsets.set(node, offset);
}
