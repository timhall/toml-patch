import {
  Node,
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
  InlineArray,
  Comment
} from './ast';
import { Token, TokenType, tokenize, findPosition, findLines } from './tokenizer';

export default function parseTOML(input: string): Document {
  const lines = findLines(input);
  const tokens = tokenize(input);

  let current = 0;
  const peek = (skip: number = 1) => tokens[current + skip];

  function walkBlock(): KeyValue | Table | TableArray | Comment {
    let token: Token = tokens[current];
    const next = (skip: number = 1) => {
      current += skip;
      return tokens[current];
    };
    const step = () => current++;

    if (token.token_type === TokenType.Comment) {
      // 1. Comment
      //
      // # line comment
      // ^------------^ Comment
      const comment: Comment = convert(token, node => {
        node.type = NodeType.Comment;
      });

      step();
      return comment;
    } else if (token.token_type === TokenType.Bracket) {
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
      const type = peek().token_type === TokenType.Bracket ? NodeType.TableArray : NodeType.Table;
      const is_table = type === NodeType.Table;

      if (is_table && token.raw !== '[') {
        throw new Error(`Expected table opening "[", found ${token}`);
      }
      if (!is_table && (token.raw !== '[' || peek().raw !== '[')) {
        throw new Error(`Expected array of tables opening "[[", found ${token} and ${peek()}`);
      }

      // Set start location from opening tag
      const key = is_table
        ? (convert(token, node => {
            node.type = NodeType.TableKey;
          }) as TableKey)
        : (convert(token, node => {
            node.type = NodeType.TableArrayKey;
          }) as TableArrayKey);

      // Skip to token for key value
      token = type === NodeType.TableArray ? next() : next(2);

      key.value = convert(token, node => {
        node.type = NodeType.Key;
        node.value = parseKey(token.raw);
      });

      token = next();

      if (is_table && token.raw !== ']') {
        throw new Error(`Expected table closing "]", found ${token}`);
      }
      if (!is_table && (token.raw !== ']' || peek().raw !== ']')) {
        throw new Error(`Expected array of tables closing "]]", found ${token} and ${peek()}`);
      }

      // Set end location from closing tag
      if (!is_table) token = next();
      key.loc.end = token.loc.end;

      // Add child items
      const items: Array<KeyValue | Comment> = [];
      while (token.token_type !== TokenType.Bracket) {
        items.push(walkBlock() as (KeyValue | Comment));
        token = tokens[current];
      }

      // (no step(), already stepped to next token in items loop above)
      return {
        type: is_table ? NodeType.Table : NodeType.TableArray,
        loc: {
          start: key.loc.start,
          end: items.length ? items[items.length - 1].loc.end : key.loc.end
        },
        key,
        items
      } as Table | TableArray;
    } else if (token.token_type === TokenType.String) {
      // 3. KeyValue
      //
      // key = value
      // ^-^          key
      //     ^        equals
      //       ^---^  value
      if (peek().token_type !== TokenType.Equal) {
        throw new Error(`Expected key = value, found ${token} and ${peek()}`);
      }

      const key: Key = convert(token, node => {
        node.type = NodeType.Key;
        node.value = parseKey(token.raw);
      });

      token = next();
      const equals = token.loc.start.column;

      token = next();
      const value = walkValue();

      step();
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
      throw new Error(`Unexpected token ${token}`);
    }
  }

  function walkValue(): Value {
    // TODO
    const value = {
      type: NodeType.Integer,
      loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
      raw: '0',
      value: 0
    } as Integer;

    return value;
  }

  let document: Document = {
    type: NodeType.Document,
    loc: { start: { line: 1, column: 0 }, end: findPosition(lines, input.length) },
    body: []
  };

  while (current < tokens.length) {
    document.body.push(walkBlock());
  }

  return document;
}

export function convert<TInput, TOutput>(
  value: TInput,
  conversion: (value: Partial<TOutput>) => void
): TOutput {
  const output: Partial<TOutput> = value;
  conversion(output);

  return output as TOutput;
}

export function parseKey(raw: string): string[] {}
