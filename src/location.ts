export interface Location {
  start: Position;
  end: Position;
}

export interface Position {
  // Note: line is 1-indexed while column is 0-indexed
  line: number;
  column: number;
}

export type Locator = (start: number, end: number) => Location;

export function createLocate(input: string): Locator {
  const lines = findLines(input);

  return (start: number, end: number) => {
    return {
      start: findPosition(lines, start),
      end: findPosition(lines, end)
    };
  };
}

export function findPosition(input: string | number[], index: number): Position {
  // abc\ndef\ng
  // 0123 4567 8
  //      012
  //           0
  //
  // lines = [3, 7, 9]
  //
  // c = 2: 0 -> 1, 2 - (undefined + 1 || 0) = 2
  //     3: 0 -> 1, 3 - (undefined + 1 || 0) = 3
  // e = 5: 1 -> 2, 5 - (3 + 1 || 0) = 1
  // g = 8: 2 -> 3, 8 - (7 + 1 || 0) = 0

  const lines = Array.isArray(input) ? input : findLines(input);
  const line = lines.findIndex(line_index => line_index >= index) + 1;
  const column = index - (lines[line - 2] + 1 || 0);

  return { line, column };
}

export function getLine(input: string, position: Position): string {
  const lines = findLines(input);
  const start = lines[position.line - 2] || 0;
  const end = lines[position.line - 1] || input.length;

  return input.substr(start, end - start);
}

export function findLines(input: string): number[] {
  // exec is stateful, so create new regexp each time
  const BY_NEW_LINE = /[\r\n|\n]/g;
  const indexes: number[] = [];

  let match;
  while ((match = BY_NEW_LINE.exec(input)) != null) {
    indexes.push(match.index);
  }

  return indexes.concat([input.length + 1]);
}

export function clonePosition(position: Position): Position {
  return { line: position.line, column: position.column };
}

export function cloneLocation(location: Location): Location {
  return { start: clonePosition(location.start), end: clonePosition(location.end) };
}
