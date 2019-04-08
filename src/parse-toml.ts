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
import { parseString, parseKey } from './parse-string';
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

  function walkBlock(): KeyValue | Table | TableArray | Comment {
    if (cursor.item!.type === TokenType.Comment) {
      // 1. Comment
      //
      // # line comment
      // ^------------^ Comment
      const comment: Comment = {
        type: NodeType.Comment,
        loc: cursor.item!.loc,
        raw: cursor.item!.raw
      };

      cursor.step();
      return comment;
    } else if (cursor.item!.type === TokenType.Bracket) {
      // 2. Table or TableArray
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
        value: parseKey(cursor.item!.raw)
      };

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

      cursor.step();

      // Add child items
      const items: Array<KeyValue | Comment> = [];
      while (cursor.item! && cursor.item!.type !== TokenType.Bracket) {
        items.push(walkBlock() as (KeyValue | Comment));
      }

      // (no cursor.step(), already stepped to next cursor.item! in items loop above)
      return {
        type: is_table ? NodeType.Table : NodeType.TableArray,
        loc: {
          start: key.loc!.start,
          end: items.length ? items[items.length - 1].loc.end : key.loc!.end
        },
        key: key as TableKey | TableArrayKey,
        items
      } as Table | TableArray;
    } else if (cursor.item!.type === TokenType.String) {
      // 3. KeyValue
      //
      // key = value
      // ^-^          key
      //     ^        equals
      //       ^---^  value
      if (cursor.peek()!.type !== TokenType.Equal) {
        throw new Error(
          `Expected key = value, found ${JSON.stringify(cursor.item!)} and ${JSON.stringify(
            cursor.peek()!
          )}`
        );
      }

      const key: Key = {
        type: NodeType.Key,
        loc: cursor.item!.loc,
        raw: cursor.item!.raw,
        value: parseKey(cursor.item!.raw)
      };

      cursor.step();
      const equals = cursor.item!.loc.start.column;

      cursor.step();
      const value = walkValue();

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
    } else {
      throw new Error(`Unexpected cursor.item! ${JSON.stringify(cursor.item!)}`);
    }
  }

  function walkValue(): Value {
    if (cursor.item!.type === TokenType.String) {
      // 1. String
      if (cursor.item!.raw[0] === DOUBLE_QUOTE || cursor.item!.raw[0] === SINGLE_QUOTE) {
        const value: String = {
          type: NodeType.String,
          loc: cursor.item!.loc,
          raw: cursor.item!.raw,
          value: parseString(cursor.item!.raw)
        };

        cursor.step();
        return value;
      }

      // 2. Boolean
      if (cursor.item!.raw === TRUE || cursor.item!.raw === FALSE) {
        const value: Boolean = {
          type: NodeType.Boolean,
          loc: cursor.item!.loc,
          value: cursor.item!.raw === TRUE
        };

        cursor.step();
        return value;
      }

      // 3. DateTime
      if (IS_FULL_DATE.test(cursor.item!.raw) || IS_FULL_TIME.test(cursor.item!.raw)) {
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
        let date: Date;
        if (!IS_FULL_DATE.test(cursor.item!.raw)) {
          // For local time, use local ISO date
          const [local_date] = new Date().toISOString().split('T');
          date = new Date(`${local_date}T${cursor.item!.raw}`);
        } else {
          date = new Date(cursor.item!.raw.replace(' ', 'T'));
        }

        const value: DateTime = {
          type: NodeType.DateTime,
          loc: cursor.item!.loc,
          raw: cursor.item!.raw,
          value: date
        };

        cursor.step();
        return value;
      }

      // 4. Float
      if (
        HAS_DOT.test(cursor.item!.raw) ||
        IS_INF.test(cursor.item!.raw) ||
        IS_NAN.test(cursor.item!.raw) ||
        (HAS_E.test(cursor.item!.raw) && !IS_HEX.test(cursor.item!.raw))
      ) {
        let float;
        if (IS_INF.test(cursor.item!.raw)) {
          float = cursor.item!.raw === '-inf' ? -Infinity : Infinity;
        } else if (IS_NAN.test(cursor.item!.raw)) {
          float = cursor.item!.raw === '-nan' ? -NaN : NaN;
        } else {
          float = Number(cursor.item!.raw.replace(IS_DIVIDER, ''));
        }

        const value: Float = {
          type: NodeType.Float,
          loc: cursor.item!.loc,
          raw: cursor.item!.raw,
          value: float
        };

        cursor.step();
        return value;
      }

      // 5. Integer
      let radix = 10;
      if (IS_HEX.test(cursor.item!.raw)) {
        radix = 16;
      } else if (IS_OCTAL.test(cursor.item!.raw)) {
        radix = 8;
      } else if (IS_BINARY.test(cursor.item!.raw)) {
        radix = 2;
      }

      const int = parseInt(
        cursor
          .item!.raw.replace(IS_DIVIDER, '')
          .replace(IS_OCTAL, '')
          .replace(IS_BINARY, ''),
        radix
      );

      const value: Integer = {
        type: NodeType.Integer,
        loc: cursor.item!.loc,
        raw: cursor.item!.raw,
        value: int
      };

      cursor.step();
      return value;
    }

    if (cursor.item!.type === TokenType.Curly) {
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

        const item = walkBlock();
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
      }

      if (cursor.item!.type !== TokenType.Curly || (cursor.item! as Token).raw !== '}') {
        throw new Error(`Expected closing brace "}", found ${JSON.stringify(cursor.item!)}`);
      }

      value.loc.end = cursor.item!.loc.end;

      cursor.step();
      return value;
    }

    if (cursor.item!.type !== TokenType.Bracket) {
      throw new Error(`Unrecognized cursor.item! for value: ${JSON.stringify(cursor.item!)}`);
    }
    if (cursor.item!.raw !== '[') {
      throw new Error(
        `Expected opening brace for inline array, found ${JSON.stringify(cursor.item!)}`
      );
    }

    // 7. InlineArray
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

      const item = walkValue();
      const inline_item: InlineArrayItem = {
        type: NodeType.InlineArrayItem,
        loc: { start: item.loc.start, end: item.loc.end },
        item,
        comma: false
      };

      value.items.push(inline_item);
    }

    if (cursor.item!.type !== TokenType.Bracket || (cursor.item! as Token).raw !== ']') {
      throw new Error(`Expected closing bracket "]", found ${JSON.stringify(cursor.item!)}`);
    }

    value.loc.end = cursor.item!.loc.end;

    cursor.step();
    return value;
  }

  let document: Document = {
    type: NodeType.Document,
    loc: { start: { line: 1, column: 0 }, end: findPosition(lines, input.length) },
    body: []
  };

  while (!cursor.done) {
    document.body.push(walkBlock());
  }

  return document;
}
