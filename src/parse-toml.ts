import {
  NodeType,
  Document,
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
  Comment
} from './ast';
import {
  Token,
  TokenType,
  tokenize,
  findPosition,
  findLines,
  DOUBLE_QUOTE,
  SINGLE_QUOTE,
  IS_FULL_DATE,
  IS_FULL_TIME
} from './tokenizer';
import { parseString } from './parse-string';
import Cursor from './cursor';

const TRUE = 'true';
const FALSE = 'false';
const HAS_DOT = /\./;
const HAS_E = /e/i;
const IS_DIVIDER = /\_/g;
const IS_INF = /inf/;
const IS_NAN = /nan/;
const IS_HEX = /^0x/;
const IS_OCTAL = /^0o/;
const IS_BINARY = /^0b/;

export default function parseTOML(input: string): Document {
  const lines = findLines(input);
  const tokens = tokenize(input);
  const cursor = new Cursor(tokens);

  let document: Document = {
    type: NodeType.Document,
    loc: { start: { line: 1, column: 0 }, end: findPosition(lines, input.length) },
    body: []
  };

  while (!cursor.done) {
    document.body.push(walkBlock(cursor));
    cursor.step();
  }

  return document;
}

function walkBlock(cursor: Cursor<Token>): KeyValue | Table | TableArray | Comment {
  if (cursor.item!.type === TokenType.Comment) {
    return comment(cursor);
  } else if (cursor.item!.type === TokenType.Bracket) {
    return table(cursor);
  } else if (cursor.item!.type === TokenType.String) {
    return keyValue(cursor);
  } else {
    throw new Error(`Unexpected token ${JSON.stringify(cursor.item!)}`);
  }
}

function walkValue(cursor: Cursor<Token>): Value {
  if (cursor.item!.type === TokenType.String) {
    if (cursor.item!.raw[0] === DOUBLE_QUOTE || cursor.item!.raw[0] === SINGLE_QUOTE) {
      return string(cursor);
    } else if (cursor.item!.raw === TRUE || cursor.item!.raw === FALSE) {
      return boolean(cursor);
    } else if (IS_FULL_DATE.test(cursor.item!.raw) || IS_FULL_TIME.test(cursor.item!.raw)) {
      return datetime(cursor);
    } else if (
      (!cursor.peekDone() && cursor.peek()!.type === TokenType.Dot) ||
      IS_INF.test(cursor.item!.raw) ||
      IS_NAN.test(cursor.item!.raw) ||
      (HAS_E.test(cursor.item!.raw) && !IS_HEX.test(cursor.item!.raw))
    ) {
      return float(cursor);
    } else {
      return integer(cursor);
    }
  } else if (cursor.item!.type === TokenType.Curly) {
    return inlineTable(cursor);
  } else {
    if (cursor.item!.type !== TokenType.Bracket) {
      throw new Error(`Unrecognized token for value: ${JSON.stringify(cursor.item!)}`);
    }

    return inlineArray(cursor);
  }
}

function comment(cursor: Cursor<Token>): Comment {
  // # line comment
  // ^------------^ Comment
  return {
    type: NodeType.Comment,
    loc: cursor.item!.loc,
    raw: cursor.item!.raw
  };
}

function table(cursor: Cursor<Token>): Table | TableArray {
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
  const type = cursor.peek()!.type === TokenType.Bracket ? NodeType.TableArray : NodeType.Table;
  const is_table = type === NodeType.Table;

  if (is_table && cursor.item!.raw !== '[') {
    throw new Error(`Expected table opening "[", found ${JSON.stringify(cursor.item!)}`);
  }
  if (!is_table && (cursor.item!.raw !== '[' || cursor.peek()!.raw !== '[')) {
    throw new Error(
      `Expected array of tables opening "[[", found ${JSON.stringify(
        cursor.item!
      )} and ${JSON.stringify(cursor.peek()!)}`
    );
  }

  // Set start location from opening tag
  const key = is_table
    ? ({
        type: NodeType.TableKey,
        loc: cursor.item!.loc
      } as Partial<TableKey>)
    : ({
        type: NodeType.TableArrayKey,
        loc: cursor.item!.loc
      } as Partial<TableArrayKey>);

  // Skip to cursor.item! for key value
  cursor.step(type === NodeType.TableArray ? 2 : 1);

  key.value = {
    type: NodeType.Key,
    loc: cursor.item!.loc,
    raw: cursor.item!.raw,
    value: [parseString(cursor.item!.raw)]
  };

  while (cursor.peek()!.type === TokenType.Dot) {
    cursor.step(2);

    key.value.loc.end = cursor.item!.loc.end;
    key.value.raw += `.${cursor.item!.raw}`;
    key.value.value.push(parseString(cursor.item!.raw));
  }

  cursor.step();

  if (is_table && cursor.item!.raw !== ']') {
    throw new Error(`Expected table closing "]", found ${JSON.stringify(cursor.item!)}`);
  }
  if (!is_table && (cursor.item!.raw !== ']' || cursor.peek()!.raw !== ']')) {
    throw new Error(
      `Expected array of tables closing "]]", found ${JSON.stringify(
        cursor.item!
      )} and ${JSON.stringify(cursor.peek()!)}`
    );
  }

  // Set end location from closing tag
  if (!is_table) cursor.step();
  key.loc!.end = cursor.item!.loc.end;

  // Add child items
  const items: Array<KeyValue | Comment> = [];
  while (!cursor.peekDone() && cursor.peek()!.type !== TokenType.Bracket) {
    cursor.step();
    items.push(walkBlock(cursor) as (KeyValue | Comment));
  }

  return {
    type: is_table ? NodeType.Table : NodeType.TableArray,
    loc: {
      start: key.loc!.start,
      end: items.length ? items[items.length - 1].loc.end : key.loc!.end
    },
    key: key as TableKey | TableArrayKey,
    items
  } as Table | TableArray;
}

function keyValue(cursor: Cursor<Token>): KeyValue {
  // 3. KeyValue
  //
  // key = value
  // ^-^          key
  //     ^        equals
  //       ^---^  value
  const key: Key = {
    type: NodeType.Key,
    loc: cursor.item!.loc,
    raw: cursor.item!.raw,
    value: [parseString(cursor.item!.raw)]
  };

  while (cursor.peek()!.type === TokenType.Dot) {
    cursor.step(2);

    key.loc.end = cursor.item!.loc.end;
    key.raw += `.${cursor.item!.raw}`;
    key.value.push(parseString(cursor.item!.raw));
  }

  cursor.step();

  if (cursor.item!.type !== TokenType.Equal) {
    throw new Error(`Expected "=" for key-value,  ${JSON.stringify(cursor.item!)}`);
  }

  const equals = cursor.item!.loc.start.column;

  cursor.step();
  const value = walkValue(cursor);

  return {
    type: NodeType.KeyValue,
    key,
    value,
    loc: {
      start: key.loc.start,
      end: value.loc.end
    },
    equals
  };
}

function string(cursor: Cursor<Token>): String {
  return {
    type: NodeType.String,
    loc: cursor.item!.loc,
    raw: cursor.item!.raw,
    value: parseString(cursor.item!.raw)
  };
}

function boolean(cursor: Cursor<Token>): Boolean {
  return {
    type: NodeType.Boolean,
    loc: cursor.item!.loc,
    value: cursor.item!.raw === TRUE
  };
}

function datetime(cursor: Cursor<Token>): DateTime {
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
  let loc = cursor.item!.loc;
  let raw = cursor.item!.raw;
  let value: Date;

  if (!cursor.peekDone() && cursor.peek()!.type === TokenType.Dot) {
    const start = loc.start;

    cursor.step(2);
    loc = { start, end: cursor.item!.loc.end };
    raw += `.${cursor.item!.raw}`;
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

function float(cursor: Cursor<Token>): Float {
  let loc = cursor.item!.loc;
  let raw = cursor.item!.raw;
  let value;

  if (IS_INF.test(raw)) {
    value = raw === '-inf' ? -Infinity : Infinity;
  } else if (IS_NAN.test(raw)) {
    value = raw === '-nan' ? -NaN : NaN;
  } else if (!cursor.peekDone() && cursor.peek()!.type === TokenType.Dot) {
    const start = loc.start;

    // From spec:
    // | A fractional part is a decimal point followed by one or more digits.
    //
    // -> Don't have to handle "4." (i.e. nothing behind decimal place)

    cursor.step(2);

    raw += `.${cursor.item!.raw}`;
    loc = { start, end: cursor.item!.loc.end };
    value = Number(raw.replace(IS_DIVIDER, ''));
  } else {
    value = Number(raw.replace(IS_DIVIDER, ''));
  }

  return { type: NodeType.Float, loc, raw, value };
}

function integer(cursor: Cursor<Token>): Integer {
  let radix = 10;
  if (IS_HEX.test(cursor.item!.raw)) {
    radix = 16;
  } else if (IS_OCTAL.test(cursor.item!.raw)) {
    radix = 8;
  } else if (IS_BINARY.test(cursor.item!.raw)) {
    radix = 2;
  }

  const value = parseInt(
    cursor
      .item!.raw.replace(IS_DIVIDER, '')
      .replace(IS_OCTAL, '')
      .replace(IS_BINARY, ''),
    radix
  );

  return {
    type: NodeType.Integer,
    loc: cursor.item!.loc,
    raw: cursor.item!.raw,
    value
  };
}

function inlineTable(cursor: Cursor<Token>): InlineTable {
  if (cursor.item!.raw !== '{') {
    throw new Error(
      `Expected opening brace for inline table, found ${JSON.stringify(cursor.item!)}`
    );
  }

  // 6. InlineTable
  const value: InlineTable = {
    type: NodeType.InlineTable,
    loc: cursor.item!.loc,
    items: []
  };

  cursor.step();

  while (!(cursor.item!.type === TokenType.Curly && (cursor.item! as Token).raw === '}')) {
    if ((cursor.item! as Token).type === TokenType.Comma) {
      const previous = value.items[value.items.length - 1];
      if (!previous) {
        throw new Error('Found "," without previous value');
      }

      previous.comma = true;
      previous.loc.end = cursor.item!.loc.start;

      cursor.step();
      continue;
    }

    const item = walkBlock(cursor);
    if (item.type !== NodeType.KeyValue) {
      throw new Error(
        `Only key-values are supported in inline tables, found ${JSON.stringify(item)}`
      );
    }

    const inline_item: InlineTableItem = {
      type: NodeType.InlineTableItem,
      loc: { start: item.loc.start, end: item.loc.end },
      item,
      comma: false
    };

    value.items.push(inline_item);
    cursor.step();
  }

  if (cursor.item!.type !== TokenType.Curly || (cursor.item! as Token).raw !== '}') {
    throw new Error(`Expected closing brace "}", found ${JSON.stringify(cursor.item!)}`);
  }

  value.loc.end = cursor.item!.loc.end;

  return value;
}

function inlineArray(cursor: Cursor<Token>): InlineArray {
  // 7. InlineArray
  if (cursor.item!.raw !== '[') {
    throw new Error(
      `Expected opening brace for inline array, found ${JSON.stringify(cursor.item!)}`
    );
  }

  const value: InlineArray = {
    type: NodeType.InlineArray,
    loc: cursor.item!.loc,
    items: []
  };

  cursor.step();

  while (!(cursor.item!.type === TokenType.Bracket && (cursor.item! as Token).raw === ']')) {
    if ((cursor.item! as Token).type === TokenType.Comma) {
      const previous = value.items[value.items.length - 1];
      if (!previous) {
        throw new Error('Found "," without previous value');
      }

      previous.comma = true;
      previous.loc.end = cursor.item!.loc.start;

      cursor.step();
      continue;
    }

    if ((cursor.item! as Token).type === TokenType.Comment) {
      // TODO
      cursor.step();
      continue;
    }

    const item = walkValue(cursor);
    const inline_item: InlineArrayItem = {
      type: NodeType.InlineArrayItem,
      loc: { start: item.loc.start, end: item.loc.end },
      item,
      comma: false
    };

    value.items.push(inline_item);
    cursor.step();
  }

  if (cursor.item!.type !== TokenType.Bracket || (cursor.item! as Token).raw !== ']') {
    throw new Error(`Expected closing bracket "]", found ${JSON.stringify(cursor.item!)}`);
  }

  value.loc.end = cursor.item!.loc.end;

  return value;
}
