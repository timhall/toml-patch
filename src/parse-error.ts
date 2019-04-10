import { Position, getLine } from './location';

export default class ParseError extends Error {
  line: number;
  column: number;

  constructor(input: string, position: Position, message: string) {
    const line = getLine(input, position);
    const pointer = `${whitespace(position.column + 1)}^`;
    const error_message = `Error parsing TOML:\n${line}\n${pointer}\n${message}`;

    super(error_message);

    this.line = position.line;
    this.column = position.column;
  }
}

function whitespace(count: number, character: string = ' '): string {
  return character.repeat(count);
}
