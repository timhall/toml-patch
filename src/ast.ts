export interface Document extends Node {
  type: 'document';
  body: Array<KeyValue | Table | TableArray | Comment>;
}

export interface Table extends Node {
  type: 'table';
  key: TableKey;
  items: Array<KeyValue | Table | TableArray | Comment>;
}

export interface TableKey extends Node {
  type: 'tablekey';
  value: Key;
  comment: Comment | null;
}

export interface TableArray extends Node {
  type: 'tablearray';
  key: TableArrayKey;
  items: Array<KeyValue | Table | TableArray | Comment>;
}

export interface TableArrayKey extends Node {
  type: 'tablearraykey';
  value: Key;
  comment: Comment | null;
}

export interface KeyValue extends Node {
  type: 'keyvalue';
  key: Key;
  value: Value;

  // Column index (0-based on equals sign)
  equals: number;

  // Note: Use array to handle multiple comments in multiline arrays
  comments: Comment[] | null;
}

export interface Key extends Node {
  type: 'key';
  raw: string;
  value: string;
}

export type Value<TInlineArrayItem = unknown> =
  | String
  | Integer
  | Float
  | Boolean
  | DateTime
  | InlineArray<TInlineArrayItem>
  | InlineTable;

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

export interface InlineArrayItem<TItem = unknown> extends Node {
  type: 'inlinearrayitem';
  item: TItem;
  comma: boolean;
}

export interface InlineTable extends Node {
  type: 'inlinetable';
  items: InlineTableItem;
}

export interface InlineTableItem extends Node {
  type: 'inlinetableitem';
  item: KeyValue;
}

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
