export function last<TValue>(values: TValue[]): TValue | undefined {
  return values[values.length - 1];
}

export type BlankObject = { [key: string]: any };

export function blank(): BlankObject {
  return Object.create(null);
}

export function isDate(value: any) {
  return Object.prototype.toString.call(value) === '[object Date]';
}

export function has(object: any, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export function equalArrays<TItem>(a: TItem[], b: TItem[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}
