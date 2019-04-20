export function iterator<T>(value: Iterable<T>): Iterator<T> {
  return value[Symbol.iterator]();
}

export default class Cursor<T> implements Iterator<T | undefined> {
  iterator: Iterator<T>;
  index: number;
  value?: T;
  done: boolean;
  peeked: IteratorResult<T | undefined> | null;

  constructor(iterator: Iterator<T>) {
    this.iterator = iterator;
    this.index = -1;
    this.value = undefined;
    this.done = false;
    this.peeked = null;
  }

  next(): IteratorResult<T | undefined> {
    if (this.done) return done();

    const result = this.peeked || this.iterator.next();

    this.index += 1;
    this.value = result.value;
    this.done = result.done;
    this.peeked = null;

    return result;
  }

  peek(): IteratorResult<T | undefined> {
    if (this.done) return done();
    if (this.peeked) return this.peeked;

    this.peeked = this.iterator.next();
    return this.peeked;
  }

  [Symbol.iterator]() {
    return this;
  }
}

function done(): IteratorResult<undefined> {
  return { value: undefined, done: true };
}
