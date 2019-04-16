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
  Value
} from './ast';
import { Span, getSpan, clonePosition } from './location';

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
    line: replacement.loc.start.line + replacement_span.lines,
    column: replacement.loc.start.column + replacement_span.columns
  };

  const lines = replacement_span.lines - existing_span.lines;
  const columns = replacement_span.columns - existing_span.columns;

  const offsets = getStaged(ast);
  offsets.set(replacement, { lines, columns });
}

export function insert(ast: AST, parent: Node, child: Node, index?: number | 'key' | 'value') {
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

export function write(ast: AST) {
  const offsets = getStaged(ast);
  staged_offsets.delete(ast);

  //
}
