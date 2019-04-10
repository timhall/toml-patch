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

export interface Document extends Node {
  type: NodeType.Document;
  body: Array<KeyValue | Table | TableArray | Comment>;
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

// loc includes brackets
//
// [  key  ]
// ^-------^
export interface TableKey extends Node {
  type: NodeType.TableKey;
  value: Key;
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

// loc includes brackets
//
// [[  key  ]]
// ^---------^
export interface TableArrayKey extends Node {
  type: NodeType.TableArrayKey;
  value: Key;
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

export interface Key extends Node {
  type: NodeType.Key;
  raw: string;

  // Note: Array for keys with dots
  // e.g. a.b -> raw = 'a.b', value = ['a', 'b']
  value: string[];
}

export type Value<TInlineArrayItem = Node> =
  | String
  | Integer
  | Float
  | Boolean
  | DateTime
  | InlineArray<TInlineArrayItem>
  | InlineTable;

// loc includes quotes
//
// a = "string"
//     ^------^
export interface String extends Node {
  type: NodeType.String;
  raw: string;
  value: string;
}

export interface Integer extends Node {
  type: NodeType.Integer;
  raw: string;
  value: number;
}

export interface Float extends Node {
  type: NodeType.Float;
  raw: string;
  value: number;
}

export interface Boolean extends Node {
  type: NodeType.Boolean;

  // Only `true` and `false` are permitted
  // -> don't need separate raw and value
  value: boolean;
}

export interface DateTime extends Node {
  type: NodeType.DateTime;
  raw: string;
  value: Date;
}

export interface InlineArray<TItem = Node> extends Node {
  type: NodeType.InlineArray;
  items: InlineArrayItem<TItem>[];
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

export interface InlineTable extends Node {
  type: NodeType.InlineTable;
  items: InlineTableItem[];
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

// loc starts at "#" and goes to end of comment (trailing whitespace ignored)
//
// # comment here
// ^------------^
export interface Comment extends Node {
  type: NodeType.Comment;
  raw: string;
}

export type Node = {
  type: NodeType;
  loc: Location;
};
