export interface Indexable<T> {
  length: number;
  [index: number]: T | undefined;
}

export default class Cursor<T> {
  items: Indexable<T>;
  index: number;

  constructor(items: Indexable<T>) {
    this.items = items;
    this.index = 0;
  }

  get item(): T | undefined {
    return this.items[this.index];
  }
  get done(): boolean {
    return this.index >= this.items.length;
  }

  step(count: number = 1) {
    this.index += count;
  }
  peek(): T | undefined {
    return this.items[this.index + 1];
  }
  peekDone(): boolean {
    return this.index + 1 >= this.items.length;
  }
}
