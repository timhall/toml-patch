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

    const isTrailingComment = () => {
      if (token.token_type !== TokenType.Comment) return false;

      let skip = 1;
      while (peek(skip).token_type === TokenType.Comment) {
        skip++;
      }

      return peek(skip).token_type === TokenType.Bracket;
    };

    if (token.token_type === TokenType.Comment) {
      // 1. Comment
      //
      // # line comment
      // ^------------^ Comment
      //
      // Note: trailing comments are not parsed as blocks
      // and instead are part of keys and key-values

      const comment: Comment = convert(token, node => {
        node.type = NodeType.Comment;
      });

      step();
      return comment;
    } else if (token.token_type === TokenType.Bracket && peek().token_type === TokenType.Bracket) {
      // 2. TableArray
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
      if (token.raw !== '[' || peek().raw !== '[') {
        throw new Error(`Expected array of tables opening "[[", found ${token} and ${peek()}`);
      }

      // Set start location from opening tag
      const key: TableArrayKey = convert(token, node => {
        node.type = NodeType.TableArrayKey;
      });

      // Skip to token for key value
      token = next(2);

      key.value = convert(token, node => {
        node.type = NodeType.Key;
        node.value = parseKey(token.raw);
      });

      token = next();

      if (token.raw !== ']' || peek().raw !== ']') {
        throw new Error(`Expected array of tables closing "]]", found ${token} and ${peek()}`);
      }

      // Set end location from closing tag
      token = next();
      key.loc.end = token.loc.end;

      // Add child items
      //
      // Note: semantically, parser considers trailing comment lines
      // to be part of next block or at least detached
      //
      // ```toml
      // [a]
      // # note about name
      // name = "Tim"
      //
      // # note about b
      // [b]
      // ```
      //
      // "# note about b" is likely "attached" to table b, not table a
      // For flexibility, parser considers it separate block
      const items: Array<KeyValue | Comment> = [];
      while (token.token_type !== TokenType.Bracket && !isTrailingComment()) {
        items.push(walkBlock() as (KeyValue | Comment));
        token = tokens[current];
      }

      // (no step(), already check next token in items loop above)

      return {
        type: NodeType.TableArray,
        loc: {
          start: key.loc.start,
          end: items.length ? items[items.length - 1].loc.end : key.loc.end
        },
        key,
        items
      };
    } else if (token.token_type === TokenType.Bracket) {
      // 3. Table
      //
      // [ key ]
      // ^-----^   TableKey
      //   ^-^     Key
      //
      // a = "b" < Items
      // # c     |
      // d = "f" <
      //
      // ...
      if (token.raw !== '[') {
        throw new Error(`Expected table opening "[", found ${token}`);
      }

      // Set start location from opening tag
      const key: TableKey = convert(token, node => {
        node.type = NodeType.TableKey;
      });

      // Skip to token for key value
      token = next();

      key.value = convert(token, node => {
        node.type = NodeType.Key;
        node.value = parseKey(token.raw);
      });

      token = next();

      if (token.raw !== ']') {
        throw new Error(`Expected table closing "]", found ${token}`);
      }

      // Set end location from closing tag
      key.loc.end = token.loc.end;

      // Add child items
      // (see TableArray for details)
      const items: Array<KeyValue | Comment> = [];
      while (token.token_type !== TokenType.Bracket && !isTrailingComment()) {
        items.push(walkBlock() as (KeyValue | Comment));
        token = tokens[current];
      }

      // (no step(), already check next token in items loop above)

      return {
        type: NodeType.Table,
        loc: {
          start: key.loc.start,
          end: items.length ? items[items.length - 1].loc.end : key.loc.end
        },
        key,
        items
      };
    } else if (token.token_type === TokenType.String) {
      // 4. KeyValue
      if (peek().token_type !== TokenType.Equal) {
        throw new Error(`Expected key = value, found ${token} and ${peek()}`);
      }

      const key: Key = convert(token, node => {
        node.type = NodeType.Key;
        node.value = parseKey(token.raw);
      });

      next();
      const equals = token.loc.start.column;

      const [value, comments] = walkValue();
      const last_comment = comments[comments.length - 1];

      step();
      return {
        type: NodeType.KeyValue,
        key,
        value,
        loc: {
          start: key.loc.start,
          end:
            last_comment && last_comment.loc.end.line === value.loc.end.line
              ? last_comment.loc.end
              : value.loc.end
        },
        equals,
        comments
      };
    } else {
      throw new Error(`Unexpected token ${token}`);
    }
  }

  function walkValue(): [Value, Comment[]] {
    // TODO
    const value = {
      type: NodeType.Integer,
      loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
      raw: '0',
      value: 0
    } as Integer;
    const comments: Comment[] = [];

    return [value, comments];
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

export function parseKey(raw: string): string[] {
  // TODO
  return [raw];
}
