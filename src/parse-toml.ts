import {
  NodeType,
  KeyValue,
  Table,
  TableKey,
  TableArray,
  TableArrayKey,
  Key,
  Value,
  String,
  Integer,
  Float,
  Boolean,
  DateTime,
  InlineTable,
  InlineTableItem,
  InlineArray,
  InlineArrayItem,
  Comment,
  AST,
  Block
} from './ast';
import { Token, TokenType, tokenize, DOUBLE_QUOTE, SINGLE_QUOTE } from './tokenizer';
import { parseString } from './parse-string';
import Cursor from './cursor';
import { clonePosition, cloneLocation } from './location';
import ParseError from './parse-error';

const TRUE = 'true';
const FALSE = 'false';
const HAS_E = /e/i;
const IS_DIVIDER = /\_/g;
const IS_INF = /inf/;
const IS_NAN = /nan/;
const IS_HEX = /^0x/;
const IS_OCTAL = /^0o/;
const IS_BINARY = /^0b/;
export const IS_FULL_DATE = /(\d{4})-(\d{2})-(\d{2})/;
export const IS_FULL_TIME = /(\d{2}):(\d{2}):(\d{2})/;

export default function* parseTOML(input: string): AST {
  const tokens = tokenize(input);
  const cursor = new Cursor(tokens);

  while (!cursor.next().done) {
    yield* walkBlock(cursor, input);
  }
}

function* walkBlock(cursor: Cursor<Token>, input: string): IterableIterator<Block> {
  if (cursor.value!.type === TokenType.Comment) {
    yield comment(cursor);
  } else if (cursor.value!.type === TokenType.Bracket) {
    yield table(cursor, input);
  } else if (cursor.value!.type === TokenType.String) {
    yield* keyValue(cursor, input);
  } else {
    throw new ParseError(
      input,
      cursor.value!.loc.start,
      `Unexpected token "${cursor.value!.type}". Expected Comment, Bracket, or String`
    );
  }
}

function* walkValue(cursor: Cursor<Token>, input: string): IterableIterator<Value | Comment> {
  if (cursor.value!.type === TokenType.String) {
    if (cursor.value!.raw[0] === DOUBLE_QUOTE || cursor.value!.raw[0] === SINGLE_QUOTE) {
      yield string(cursor);
    } else if (cursor.value!.raw === TRUE || cursor.value!.raw === FALSE) {
      yield boolean(cursor);
    } else if (IS_FULL_DATE.test(cursor.value!.raw) || IS_FULL_TIME.test(cursor.value!.raw)) {
      yield datetime(cursor, input);
    } else if (
      (!cursor.peek().done && cursor.peek().value!.type === TokenType.Dot) ||
      IS_INF.test(cursor.value!.raw) ||
      IS_NAN.test(cursor.value!.raw) ||
      (HAS_E.test(cursor.value!.raw) && !IS_HEX.test(cursor.value!.raw))
    ) {
      yield float(cursor, input);
    } else {
      yield integer(cursor);
    }
  } else if (cursor.value!.type === TokenType.Curly) {
    yield inlineTable(cursor, input);
  } else if (cursor.value!.type === TokenType.Bracket) {
    const [inline_array, comments] = inlineArray(cursor, input);

    yield inline_array;
    yield* comments;
  } else {
    throw new ParseError(
      input,
      cursor.value!.loc.start,
      `Unrecognized token type "${cursor.value!.type}". Expected String, Curly, or Bracket`
    );
  }
}

function comment(cursor: Cursor<Token>): Comment {
  // # line comment
  // ^------------^ Comment
  return {
    type: NodeType.Comment,
    loc: cursor.value!.loc,
    raw: cursor.value!.raw
  };
}

function table(cursor: Cursor<Token>, input: string): Table | TableArray {
  // Table or TableArray
  //
  // [ key ]
  // ^-----^    TableKey
  //   ^-^      Key
  //
  // [[ key ]]
  // ^ ------^  TableArrayKey
  //    ^-^     Key
  //
  // a = "b"  < Items
  // # c      |
  // d = "f"  <
  //
  // ...
  const type =
    !cursor.peek().done && cursor.peek().value!.type === TokenType.Bracket
      ? NodeType.TableArray
      : NodeType.Table;
  const is_table = type === NodeType.Table;

  if (is_table && cursor.value!.raw !== '[') {
    throw new ParseError(
      input,
      cursor.value!.loc.start,
      `Expected table opening "[", found ${cursor.value!.raw}`
    );
  }
  if (!is_table && (cursor.value!.raw !== '[' || cursor.peek().value!.raw !== '[')) {
    throw new ParseError(
      input,
      cursor.value!.loc.start,
      `Expected array of tables opening "[[", found ${cursor.value!.raw + cursor.peek().value!.raw}`
    );
  }

  // Set start location from opening tag
  const key = is_table
    ? ({
        type: NodeType.TableKey,
        loc: cursor.value!.loc
      } as Partial<TableKey>)
    : ({
        type: NodeType.TableArrayKey,
        loc: cursor.value!.loc
      } as Partial<TableArrayKey>);

  // Skip to cursor.value for key value
  cursor.next();
  if (type === NodeType.TableArray) cursor.next();

  if (cursor.done) {
    throw new ParseError(input, key.loc!.start, `Expected table key, reached end of file`);
  }

  key.item = {
    type: NodeType.Key,
    loc: cloneLocation(cursor.value!.loc),
    raw: cursor.value!.raw,
    value: [parseString(cursor.value!.raw)]
  };

  while (!cursor.peek().done && cursor.peek().value!.type === TokenType.Dot) {
    cursor.next();
    const dot = cursor.value!;

    cursor.next();
    const before = ' '.repeat(dot.loc.start.column - key.item.loc.end.column);
    const after = ' '.repeat(cursor.value!.loc.start.column - dot.loc.end.column);

    key.item.loc.end = cursor.value!.loc.end;
    key.item.raw += `${before}.${after}${cursor.value!.raw}`;
    key.item.value.push(parseString(cursor.value!.raw));
  }

  cursor.next();

  if (is_table && (cursor.done || cursor.value!.raw !== ']')) {
    throw new ParseError(
      input,
      cursor.done ? key.item.loc.end : cursor.value!.loc.start,
      `Expected table closing "]", found ${cursor.done ? 'end of file' : cursor.value!.raw}`
    );
  }
  if (
    !is_table &&
    (cursor.done ||
      cursor.peek().done ||
      cursor.value!.raw !== ']' ||
      cursor.peek().value!.raw !== ']')
  ) {
    throw new ParseError(
      input,
      cursor.done || cursor.peek().done ? key.item.loc.end : cursor.value!.loc.start,
      `Expected array of tables closing "]]", found ${
        cursor.done || cursor.peek().done
          ? 'end of file'
          : cursor.value!.raw + cursor.peek().value!.raw
      }`
    );
  }

  // Set end location from closing tag
  if (!is_table) cursor.next();
  key.loc!.end = cursor.value!.loc.end;

  // Add child items
  let items: Array<KeyValue | Comment> = [];
  while (!cursor.peek().done && cursor.peek().value!.type !== TokenType.Bracket) {
    cursor.next();
    items = items.concat([...walkBlock(cursor, input)] as Array<KeyValue | Comment>);
  }

  return {
    type: is_table ? NodeType.Table : NodeType.TableArray,
    loc: {
      start: clonePosition(key.loc!.start),
      end: items.length
        ? clonePosition(items[items.length - 1].loc.end)
        : clonePosition(key.loc!.end)
    },
    key: key as TableKey | TableArrayKey,
    items
  } as Table | TableArray;
}

function keyValue(cursor: Cursor<Token>, input: string): Array<KeyValue | Comment> {
  // 3. KeyValue
  //
  // key = value
  // ^-^          key
  //     ^        equals
  //       ^---^  value
  const key: Key = {
    type: NodeType.Key,
    loc: cloneLocation(cursor.value!.loc),
    raw: cursor.value!.raw,
    value: [parseString(cursor.value!.raw)]
  };

  while (!cursor.peek().done && cursor.peek().value!.type === TokenType.Dot) {
    cursor.next();
    cursor.next();

    key.loc.end = cursor.value!.loc.end;
    key.raw += `.${cursor.value!.raw}`;
    key.value.push(parseString(cursor.value!.raw));
  }

  cursor.next();

  if (cursor.done || cursor.value!.type !== TokenType.Equal) {
    throw new ParseError(
      input,
      cursor.done ? key.loc.end : cursor.value!.loc.start,
      `Expected "=" for key-value, found ${cursor.done ? 'end of file' : cursor.value!.raw}`
    );
  }

  const equals = cursor.value!.loc.start.column;

  cursor.next();

  if (cursor.done) {
    throw new ParseError(input, key.loc.start, `Expected value for key-value, reached end of file`);
  }

  const [value, ...comments] = walkValue(cursor, input) as Iterable<Value | Comment>;

  return [
    {
      type: NodeType.KeyValue,
      key,
      value: value as Value,
      loc: {
        start: clonePosition(key.loc.start),
        end: clonePosition(value.loc.end)
      },
      equals
    },
    ...(comments as Comment[])
  ];
}

function string(cursor: Cursor<Token>): String {
  return {
    type: NodeType.String,
    loc: cursor.value!.loc,
    raw: cursor.value!.raw,
    value: parseString(cursor.value!.raw)
  };
}

function boolean(cursor: Cursor<Token>): Boolean {
  return {
    type: NodeType.Boolean,
    loc: cursor.value!.loc,
    value: cursor.value!.raw === TRUE
  };
}

function datetime(cursor: Cursor<Token>, input: string): DateTime {
  // Possible values:
  //
  // Offset Date-Time
  // | odt1 = 1979-05-27T07:32:00Z
  // | odt2 = 1979-05-27T00:32:00-07:00
  // | odt3 = 1979-05-27T00:32:00.999999-07:00
  // | odt4 = 1979-05-27 07:32:00Z
  //
  // Local Date-Time
  // | ldt1 = 1979-05-27T07:32:00
  // | ldt2 = 1979-05-27T00:32:00.999999
  //
  // Local Date
  // | ld1 = 1979-05-27
  //
  // Local Time
  // | lt1 = 07:32:00
  // | lt2 = 00:32:00.999999
  let loc = cursor.value!.loc;
  let raw = cursor.value!.raw;
  let value: Date;

  // If next token is string,
  // check if raw is full date and following is full time
  if (
    !cursor.peek().done &&
    cursor.peek().value!.type === TokenType.String &&
    IS_FULL_DATE.test(raw) &&
    IS_FULL_TIME.test(cursor.peek().value!.raw)
  ) {
    const start = loc.start;

    cursor.next();
    loc = { start, end: cursor.value!.loc.end };
    raw += ` ${cursor.value!.raw}`;
  }

  if (!cursor.peek().done && cursor.peek().value!.type === TokenType.Dot) {
    const start = loc.start;

    cursor.next();

    if (cursor.peek().done || cursor.peek().value!.type !== TokenType.String) {
      throw new ParseError(input, cursor.value!.loc.end, `Expected fractional value for DateTime`);
    }
    cursor.next();

    loc = { start, end: cursor.value!.loc.end };
    raw += `.${cursor.value!.raw}`;
  }

  if (!IS_FULL_DATE.test(raw)) {
    // For local time, use local ISO date
    const [local_date] = new Date().toISOString().split('T');
    value = new Date(`${local_date}T${raw}`);
  } else {
    value = new Date(raw.replace(' ', 'T'));
  }

  return {
    type: NodeType.DateTime,
    loc,
    raw,
    value
  };
}

function float(cursor: Cursor<Token>, input: string): Float {
  let loc = cursor.value!.loc;
  let raw = cursor.value!.raw;
  let value;

  if (IS_INF.test(raw)) {
    value = raw === '-inf' ? -Infinity : Infinity;
  } else if (IS_NAN.test(raw)) {
    value = raw === '-nan' ? -NaN : NaN;
  } else if (!cursor.peek().done && cursor.peek().value!.type === TokenType.Dot) {
    const start = loc.start;

    // From spec:
    // | A fractional part is a decimal point followed by one or more digits.
    //
    // -> Don't have to handle "4." (i.e. nothing behind decimal place)

    cursor.next();

    if (cursor.peek().done || cursor.peek().value!.type !== TokenType.String) {
      throw new ParseError(input, cursor.value!.loc.end, `Expected fraction value for Float`);
    }
    cursor.next();

    raw += `.${cursor.value!.raw}`;
    loc = { start, end: cursor.value!.loc.end };
    value = Number(raw.replace(IS_DIVIDER, ''));
  } else {
    value = Number(raw.replace(IS_DIVIDER, ''));
  }

  return { type: NodeType.Float, loc, raw, value };
}

function integer(cursor: Cursor<Token>): Integer {
  // > Integer values -0 and +0 are valid and identical to an unprefixed zero
  if (cursor.value!.raw === '-0' || cursor.value!.raw === '+0') {
    return {
      type: NodeType.Integer,
      loc: cursor.value!.loc,
      raw: cursor.value!.raw,
      value: 0
    };
  }

  let radix = 10;
  if (IS_HEX.test(cursor.value!.raw)) {
    radix = 16;
  } else if (IS_OCTAL.test(cursor.value!.raw)) {
    radix = 8;
  } else if (IS_BINARY.test(cursor.value!.raw)) {
    radix = 2;
  }

  const value = parseInt(
    cursor
      .value!.raw.replace(IS_DIVIDER, '')
      .replace(IS_OCTAL, '')
      .replace(IS_BINARY, ''),
    radix
  );

  return {
    type: NodeType.Integer,
    loc: cursor.value!.loc,
    raw: cursor.value!.raw,
    value
  };
}

function inlineTable(cursor: Cursor<Token>, input: string): InlineTable {
  if (cursor.value!.raw !== '{') {
    throw new ParseError(
      input,
      cursor.value!.loc.start,
      `Expected "{" for inline table, found ${cursor.value!.raw}`
    );
  }

  // 6. InlineTable
  const value: InlineTable = {
    type: NodeType.InlineTable,
    loc: cloneLocation(cursor.value!.loc),
    items: []
  };

  cursor.next();

  while (
    !cursor.done &&
    !(cursor.value!.type === TokenType.Curly && (cursor.value as Token).raw === '}')
  ) {
    if ((cursor.value as Token).type === TokenType.Comma) {
      const previous = value.items[value.items.length - 1];
      if (!previous) {
        throw new ParseError(
          input,
          cursor.value!.loc.start,
          'Found "," without previous value in inline table'
        );
      }

      previous.comma = true;
      previous.loc.end = cursor.value!.loc.start;

      cursor.next();
      continue;
    }

    const [item] = walkBlock(cursor, input);
    if (item.type !== NodeType.KeyValue) {
      throw new ParseError(
        input,
        cursor.value!.loc.start,
        `Only key-values are supported in inline tables, found ${item.type}`
      );
    }

    const inline_item: InlineTableItem = {
      type: NodeType.InlineTableItem,
      loc: cloneLocation(item.loc),
      item,
      comma: false
    };

    value.items.push(inline_item);
    cursor.next();
  }

  if (
    cursor.done ||
    cursor.value!.type !== TokenType.Curly ||
    (cursor.value as Token).raw !== '}'
  ) {
    throw new ParseError(
      input,
      cursor.done ? value.loc.start : cursor.value!.loc.start,
      `Expected "}", found ${cursor.done ? 'end of file' : cursor.value!.raw}`
    );
  }

  value.loc.end = cursor.value!.loc.end;

  return value;
}

function inlineArray(cursor: Cursor<Token>, input: string): [InlineArray, Comment[]] {
  // 7. InlineArray
  if (cursor.value!.raw !== '[') {
    throw new ParseError(
      input,
      cursor.value!.loc.start,
      `Expected "[" for inline array, found ${cursor.value!.raw}`
    );
  }

  const value: InlineArray = {
    type: NodeType.InlineArray,
    loc: cloneLocation(cursor.value!.loc),
    items: []
  };
  let comments: Comment[] = [];

  cursor.next();

  while (
    !cursor.done &&
    !(cursor.value!.type === TokenType.Bracket && (cursor.value as Token).raw === ']')
  ) {
    if ((cursor.value as Token).type === TokenType.Comma) {
      const previous = value.items[value.items.length - 1];
      if (!previous) {
        throw new ParseError(
          input,
          cursor.value!.loc.start,
          'Found "," without previous value for inline array'
        );
      }

      previous.comma = true;
      previous.loc.end = cursor.value!.loc.start;
    } else if ((cursor.value as Token).type === TokenType.Comment) {
      comments.push(comment(cursor));
    } else {
      const [item, ...additional_comments] = walkValue(cursor, input);
      const inline_item: InlineArrayItem = {
        type: NodeType.InlineArrayItem,
        loc: cloneLocation(item.loc),
        item,
        comma: false
      };

      value.items.push(inline_item);
      comments = comments.concat(additional_comments as Comment[]);
    }

    cursor.next();
  }

  if (
    cursor.done ||
    cursor.value!.type !== TokenType.Bracket ||
    (cursor.value as Token).raw !== ']'
  ) {
    throw new ParseError(
      input,
      cursor.done ? value.loc.start : cursor.value!.loc.start,
      `Expected "]", found ${cursor.done ? 'end of file' : cursor.value!.raw}`
    );
  }

  value.loc.end = cursor.value!.loc.end;

  return [value, comments];
}
