import { Location } from './location';

export enum NodeType {
  Document = 'Document',
  Table = 'Table',
  TableKey = 'TableKey',
  TableArray = 'TableArray',
  TableArrayKey = 'TableArrayKey',
  KeyValue = 'KeyValue',
  Key = 'Key',
  String = 'String',
  Integer = 'Integer',
  Float = 'Float',
  Boolean = 'Boolean',
  DateTime = 'DateTime',
  InlineArray = 'InlineArray',
  InlineArrayItem = 'InlineArrayItem',
  InlineTable = 'InlineTable',
  InlineTableItem = 'InlineTableItem',
  Comment = 'Comment'
}

export type AST = Document | Value;

export interface Document extends Node {
  type: NodeType.Document;
  items: Array<Block>;
}
export function isDocument(node: Node): node is Document {
  return node.type === NodeType.Document;
}

export type Block = KeyValue | Table | TableArray | Comment;
export function isBlock(node: Node): node is Block {
  return isKeyValue(node) || isTable(node) || isTableArray(node) || isComment(node);
}

// v-------|
// [table] |
// b = "c" |
//         |
// # note  |
//      ^--|
// [b]
export interface Table extends Node {
  type: NodeType.Table;
  key: TableKey;
  items: Array<KeyValue | Comment>;
}
export function isTable(node: Node): node is Table {
  return node.type === NodeType.Table;
}

// loc includes brackets
//
// [  key  ]
// ^-------^
export interface TableKey extends Node {
  type: NodeType.TableKey;
  item: Key;
}
export function isTableKey(node: Node): node is TableKey {
  return node.type === NodeType.TableKey;
}

// v---------|
// [[array]] |
// a="b"     |
//           |
// # details |
//         ^-|
// [[array]]
export interface TableArray extends Node {
  type: NodeType.TableArray;
  key: TableArrayKey;
  items: Array<KeyValue | Comment>;
}
export function isTableArray(node: Node): node is TableArray {
  return node.type === NodeType.TableArray;
}

// loc includes brackets
//
// [[  key  ]]
// ^---------^
export interface TableArrayKey extends Node {
  type: NodeType.TableArrayKey;
  item: Key;
}
export function isTableArrayKey(node: Node): node is TableArrayKey {
  return node.type === NodeType.TableArrayKey;
}

// key="value" # note
// ^---------^
export interface KeyValue extends Node {
  type: NodeType.KeyValue;
  key: Key;
  value: Value;

  // Column index (0-based) of equals sign
  equals: number;
}
export function isKeyValue(node: Node): node is KeyValue {
  return node.type === NodeType.KeyValue;
}

export interface Key extends Node {
  type: NodeType.Key;
  raw: string;

  // Note: Array for keys with dots
  // e.g. a.b -> raw = 'a.b', value = ['a', 'b']
  value: string[];
}
export function isKey(node: Node): node is Key {
  return node.type === NodeType.Key;
}

export type Value<TInlineArrayItem = Node> =
  | String
  | Integer
  | Float
  | Boolean
  | DateTime
  | InlineArray<TInlineArrayItem>
  | InlineTable;
export function isValue(node: Node): node is Value {
  return (
    isString(node) ||
    isInteger(node) ||
    isFloat(node) ||
    isBoolean(node) ||
    isDateTime(node) ||
    isInlineArray(node) ||
    isInlineTable(node)
  );
}

// loc includes quotes
//
// a = "string"
//     ^------^
export interface String extends Node {
  type: NodeType.String;
  raw: string;
  value: string;
}
export function isString(node: Node): node is String {
  return node.type === NodeType.String;
}

export interface Integer extends Node {
  type: NodeType.Integer;
  raw: string;
  value: number;
}
export function isInteger(node: Node): node is Integer {
  return node.type === NodeType.Integer;
}

export interface Float extends Node {
  type: NodeType.Float;
  raw: string;
  value: number;
}
export function isFloat(node: Node): node is Float {
  return node.type === NodeType.Float;
}

export interface Boolean extends Node {
  type: NodeType.Boolean;

  // Only `true` and `false` are permitted
  // -> don't need separate raw and value
  value: boolean;
}
export function isBoolean(node: Node): node is Boolean {
  return node.type === NodeType.Boolean;
}

export interface DateTime extends Node {
  type: NodeType.DateTime;
  raw: string;
  value: Date;
}
export function isDateTime(node: Node): node is DateTime {
  return node.type === NodeType.DateTime;
}

export interface InlineArray<TItem = Node> extends Node {
  type: NodeType.InlineArray;
  items: InlineArrayItem<TItem>[];
}
export function isInlineArray(node: Node): node is InlineArray {
  return node.type === NodeType.InlineArray;
}

// loc for InlineArrayItem is from start of value to before comma
// or end-of-value if no comma
//
// [ "a"  ,"b", "c"  ]
//   ^---^ ^-^  ^-^
export interface InlineArrayItem<TItem = Node> extends Node {
  type: NodeType.InlineArrayItem;
  item: TItem;
  comma: boolean;
}
export function isInlineArrayItem(node: Node): node is InlineArrayItem {
  return node.type === NodeType.InlineArrayItem;
}

export interface InlineTable extends Node {
  type: NodeType.InlineTable;
  items: InlineTableItem[];
}
export function isInlineTable(node: Node): node is InlineTable {
  return node.type === NodeType.InlineTable;
}

// loc for InlineTableItem follows InlineArrayItem
//
// { a="b"   ,    c =    "d"   }
//   ^------^     ^--------^
export interface InlineTableItem extends Node {
  type: NodeType.InlineTableItem;
  item: KeyValue;
  comma: boolean;
}
export function isInlineTableItem(node: Node): node is InlineTableItem {
  return node.type === NodeType.InlineTableItem;
}

// loc starts at "#" and goes to end of comment (trailing whitespace ignored)
//
// # comment here
// ^------------^
export interface Comment extends Node {
  type: NodeType.Comment;
  raw: string;
}
export function isComment(node: Node): node is Comment {
  return node.type === NodeType.Comment;
}

export interface WithItems extends Node {
  items: Node[];
}
export function hasItems(node: Node): node is WithItems {
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
export function hasItem(node: Node): node is WithItem {
  return (
    isTableKey(node) || isTableArrayKey(node) || isInlineTableItem(node) || isInlineArrayItem(node)
  );
}

export interface Node {
  type: NodeType;
  loc: Location;
}
