export interface Document extends Node {
  type: 'document';
  body: Array<KeyValue | Table | TableArray | Comment>;
}

// comments are included in loc when "internal" to table
//
// v start
// [table]
// a="b"
// # included in table
// c="d"
//     ^ end
// # excluded from table (included in parent)
// [another]
export interface Table extends Node {
  type: 'table';
  key: TableKey;
  items: Array<KeyValue | Table | TableArray | Comment>;
}

// loc includes brackets
//
// [  key  ]
// ^-------^
export interface TableKey extends Node {
  type: 'tablekey';
  value: Key;
  comment: Comment | null;
}

// comments are included in loc
// (as opposed to excluded from loc in KeyValue)
//
// [[array]]
// ^ start
// a="b"
//
// # details
//         ^ end
export interface TableArray extends Node {
  type: 'tablearray';
  key: TableArrayKey;
  items: Array<KeyValue | Table | TableArray | Comment>;
}

// loc includes brackets
//
// [[  key  ]]
// ^---------^
export interface TableArrayKey extends Node {
  type: 'tablearraykey';
  value: Key;
  comment: Comment | null;
}

// comments are included for loc
//
// key="value" # note
// ^----------------^
export interface KeyValue extends Node {
  type: 'keyvalue';
  key: Key;
  value: Value;

  // Column index (0-based) of equals sign
  equals: number;

  // Note: Use array to handle multiple comments in multiline arrays
  comments: Comment[] | null;
}

export interface Key extends Node {
  type: 'key';
  raw: string;

  // Note: Array for keys with dots
  // e.g. a.b -> raw = 'a.b', value = ['a', 'b']
  value: string[];
}

export type Value<TInlineArrayItem = unknown> =
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
  type: 'string';
  raw: string;
  value: string;
}

export interface Integer extends Node {
  type: 'integer';
  raw: string;
  value: number;
}

export interface Float extends Node {
  type: 'float';
  raw: string;
  value: number;
}

export interface Boolean extends Node {
  type: 'boolean';

  // Only `true` and `false` are permitted -> don't need separate raw and value
  value: boolean;
}

export interface DateTime extends Node {
  type: 'datetime';
  raw: string;
  value: Date;
}

export interface InlineArray<TItem = unknown> extends Node {
  type: 'inlinearray';
  items: InlineArrayItem<TItem>[];
}

// loc for InlineArrayItem is from start of value to before comma
// or end-of-value if no comma
//
// [ "a"  ,"b", "c"  ]
//   ^---^ ^-^  ^-^
//
export interface InlineArrayItem<TItem = unknown> extends Node {
  type: 'inlinearrayitem';
  item: TItem;
  comma: boolean;
}

export interface InlineTable extends Node {
  type: 'inlinetable';
  items: InlineTableItem;
}

// loc for InlineTableItem follows InlineArrayItem
//
// { a="b"   ,    c =    "d"   }
//   ^------^     ^--------^
//
export interface InlineTableItem extends Node {
  type: 'inlinetableitem';
  item: KeyValue;
  comma: boolean;
}

// loc starts at "#" and goes to end of comment (trailing whitespace ignored)
export interface Comment extends Node {
  type: 'comment';
  raw: string;
}

export interface Node {
  type: string;
  loc: SourceLocation | null;
}

export interface SourceLocation {
  start: Position;
  end: Position;
}

export interface Position {
  // Note: line is 1-indexed while column is 0-indexed
  line: number;
  column: number;
}
