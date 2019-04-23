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
  InlineItem = 'InlineItem',
  InlineTable = 'InlineTable',
  Comment = 'Comment'
}

export type AST = Iterable<Block>;

//
// Document
//
// Top-level document that stores AST nodes
//
export interface Document extends Node {
  type: NodeType.Document;
  items: Array<Block>;
}
export function isDocument(node: Node): node is Document {
  return node.type === NodeType.Document;
}

//
// Table
//
// Top-level object
//
// v-------|
// [table] |
// b = "c" |
//         |
// # note  |
//      ^--|
// [b]
//
export interface Table extends Node {
  type: NodeType.Table;
  key: TableKey;
  items: Array<KeyValue | Comment>;
}
export function isTable(node: Node): node is Table {
  return node.type === NodeType.Table;
}

//
// TableKey
//
// Used to store bracket information for Table keys
//
// loc includes brackets
//
// [  key  ]
// ^-------^
//
export interface TableKey extends Node {
  type: NodeType.TableKey;
  item: Key;
}
export function isTableKey(node: Node): node is TableKey {
  return node.type === NodeType.TableKey;
}

//
// TableArray
//
// Top-level array item
//
// v---------|
// [[array]] |
// a="b"     |
//           |
// # details |
//         ^-|
// [[array]]
//
export interface TableArray extends Node {
  type: NodeType.TableArray;
  key: TableArrayKey;
  items: Array<KeyValue | Comment>;
}
export function isTableArray(node: Node): node is TableArray {
  return node.type === NodeType.TableArray;
}

//
// TableArrayKey
//
// Used to store bracket information for TableArray keys
// loc includes brackets
//
// [[  key  ]]
// ^---------^
//
export interface TableArrayKey extends Node {
  type: NodeType.TableArrayKey;
  item: Key;
}
export function isTableArrayKey(node: Node): node is TableArrayKey {
  return node.type === NodeType.TableArrayKey;
}

//
// KeyValue
//
// Key and Value nodes, with position information on equals sign
//
// key="value" # note
// ^---------^
//
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

//
// Key
//
// Store raw key and parts (from dots)
//
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

//
// String
//
// loc includes quotes
//
// a = "string"
//     ^------^
//
export interface String extends Node {
  type: NodeType.String;
  raw: string;
  value: string;
}
export function isString(node: Node): node is String {
  return node.type === NodeType.String;
}

//
// Integer
//
export interface Integer extends Node {
  type: NodeType.Integer;
  raw: string;
  value: number;
}
export function isInteger(node: Node): node is Integer {
  return node.type === NodeType.Integer;
}

//
// Float
//
export interface Float extends Node {
  type: NodeType.Float;
  raw: string;
  value: number;
}
export function isFloat(node: Node): node is Float {
  return node.type === NodeType.Float;
}

//
// Boolean
//
export interface Boolean extends Node {
  type: NodeType.Boolean;

  // Only `true` and `false` are permitted
  // -> don't need separate raw and value
  value: boolean;
}
export function isBoolean(node: Node): node is Boolean {
  return node.type === NodeType.Boolean;
}

//
// DateTime
//
// Note: Currently, Offset Date-Time, Local Date-Time, Local Date, and Local Time
// are handled via raw
//
export interface DateTime extends Node {
  type: NodeType.DateTime;
  raw: string;
  value: Date;
}
export function isDateTime(node: Node): node is DateTime {
  return node.type === NodeType.DateTime;
}

//
// InlineArray
//
export interface InlineArray<TItem = Node> extends Node {
  type: NodeType.InlineArray;
  items: InlineArrayItem<TItem>[];
}
export function isInlineArray(node: Node): node is InlineArray {
  return node.type === NodeType.InlineArray;
}

//
// InlineArrayItem
//
// loc for InlineArrayItem is from start of value to before comma
// or end-of-value if no comma
//
// [ "a"  ,"b", "c"  ]
//   ^---^ ^-^  ^-^
//
export interface InlineItem<TItem = Node> extends Node {
  type: NodeType.InlineItem;
  item: TItem;
  comma: boolean;
}
export function isInlineItem(node: Node): node is InlineItem {
  return node.type === NodeType.InlineItem;
}

export interface InlineArrayItem<TItem = Node> extends InlineItem<TItem> {}

//
// InlineTable
//
export interface InlineTable extends Node {
  type: NodeType.InlineTable;
  items: InlineTableItem[];
}
export function isInlineTable(node: Node): node is InlineTable {
  return node.type === NodeType.InlineTable;
}

//
// InlineTableItem
//
// loc for InlineTableItem follows InlineArrayItem
//
// { a="b"   ,    c =    "d"   }
//   ^------^     ^--------^
//
export interface InlineTableItem extends InlineItem<KeyValue> {}

//
// Comment
//
// loc starts at "#" and goes to end of comment (trailing whitespace ignored)
//
// # comment here
// ^------------^
//
export interface Comment extends Node {
  type: NodeType.Comment;
  raw: string;
}
export function isComment(node: Node): node is Comment {
  return node.type === NodeType.Comment;
}

//
// Combinations
//

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
  return isTableKey(node) || isTableArrayKey(node) || isInlineItem(node);
}

export type Block = KeyValue | Table | TableArray | Comment;
export function isBlock(node: Node): node is Block {
  return isKeyValue(node) || isTable(node) || isTableArray(node) || isComment(node);
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

export interface Node {
  type: NodeType;
  loc: Location;
}
