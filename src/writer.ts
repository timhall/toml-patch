import {
  AST,
  Node,
  NodeType,
  isKeyValue,
  isDocument,
  isTable,
  isTableArray,
  isInlineTable,
  isInlineArray,
  isTableKey,
  isTableArrayKey,
  isInlineTableItem,
  isInlineArrayItem,
  Key,
  Value,
  InlineArray,
  InlineArrayItem,
  InlineTableItem
} from './ast';
import { Span, getSpan, clonePosition } from './location';
import { last } from './utils';

type Offsets = WeakMap<Node, Span>;
const staged_offsets: WeakMap<AST, Offsets> = new WeakMap();
const getStaged = (ast: AST) => {
  if (!staged_offsets.has(ast)) {
    staged_offsets.set(ast, new WeakMap());
  }
  return staged_offsets.get(ast)!;
};

export interface WithItems extends Node {
  items: Node[];
}
function hasItems(node: Node): node is WithItems {
  return (
    isDocument(node) ||
    isTable(node) ||
    isTableArray(node) ||
    isInlineTable(node) ||
    isInlineArray(node)
  );
}

export interface WithItem extends Node {
  item: Node;
}
function hasItem(node: Node): node is WithItem {
  return (
    isTableKey(node) || isTableArrayKey(node) || isInlineTableItem(node) || isInlineArrayItem(node)
  );
}

export function replace(ast: AST, parent: Node, existing: Node, replacement: Node) {
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

  const existing_span = getSpan(existing.loc);
  const replacement_span = getSpan(replacement.loc);

  replacement.loc.start = clonePosition(existing.loc.start);
  replacement.loc.end = {
    line: replacement.loc.start.line + replacement_span.lines - 1,
    column: replacement.loc.start.column + replacement_span.columns
  };

  const lines = replacement_span.lines - existing_span.lines;
  const columns = replacement_span.columns - existing_span.columns;

  const offsets = getStaged(ast);
  offsets.set(replacement, { lines, columns });
}

export function insert(ast: AST, parent: Node, child: Node, index?: number) {
  if (!hasItems(parent)) {
    throw new Error(`Unsupported parent type "${parent.type}" for replace.`);
  }

  const previous = index != null ? parent.items[index - 1] : last(parent.items);

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
  const child_span = getSpan(child.loc);
  const use_new_line =
    isTable(parent) || isTableArray(parent) || (isInlineArray(parent) && perLine(parent));

  child.loc.start = previous
    ? {
        line: previous.loc.start.line,
        column: use_new_line ? previous.loc.start.column : previous.loc.end.column
      }
    : clonePosition(parent.loc.start);

  if (use_new_line) {
    child.loc.start.line += 1;
  } else {
    child.loc.start.column += previous ? 2 : 1;
  }

  child.loc.end = {
    line: child.loc.start.line + child_span.lines - 1,
    column: child.loc.start.column + child_span.columns
  };

  if (index != null) {
    parent.items.splice(index, 0, child);
  } else {
    parent.items.push(child);
  }

  const offsets = getStaged(ast);
  offsets.set(child, {
    lines: child_span.lines - (use_new_line ? 0 : 1),
    columns: child_span.columns
  });
}

export function remove(ast: AST, parent: Node, node: Node) {
  const offsets = getStaged(ast);
  if (hasItems(parent)) {
    //
  } else if (hasItem(parent)) {
    //
  } else if (isKeyValue(parent)) {
    //
  } else {
    throw new Error(`Unsupported parent type "${parent.type}" for replace.`);
  }
}

export function applyWrites(ast: AST) {
  const offsets = getStaged(ast);
  staged_offsets.delete(ast);

  //
}

function perLine(array: InlineArray): boolean {
  if (!array.items.length) return false;

  const span = getSpan(array.loc);
  return span.lines > array.items.length;
}
