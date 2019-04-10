export function last<TValue>(values: TValue[]): TValue | undefined {
  return values[values.length - 1];
}

export type BlankObject = { [key: string]: any };

export function blank(): BlankObject {
  return Object.create(null);
}
