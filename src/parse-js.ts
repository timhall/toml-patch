import { NodeType, Document, Value, KeyValue } from './ast';
import { Location } from './location';
import { isObject, isString, isInteger, isFloat, isBoolean, isDate } from './utils';

export default function parseJS(value: any): Document | Value {
  value = toJSON(value);
  if (!isObject(value)) return walkValue(value);

  return {
    type: NodeType.Document,
    loc: zero(),
    body: walkObject(value)
  };
}

function walkObject(value: any): KeyValue[] {
  return Object.keys(value).map(key => {
    return {
      type: NodeType.KeyValue,
      loc: zero(),
      key: {
        type: NodeType.Key,
        loc: zero(),
        raw: key,
        value: [key]
      },
      value: walkValue(value[key]),
      equals: 0
    };
  });
}

function walkValue(value: any): Value {
  if (isString(value)) {
    return {
      type: NodeType.String,
      loc: zero(),
      raw: value as string,
      value: value as string
    };
  } else if (isInteger(value)) {
    return {
      type: NodeType.Integer,
      loc: zero(),
      raw: String(value),
      value
    };
  } else if (isFloat(value)) {
    return {
      type: NodeType.Float,
      loc: zero(),
      raw: String(value),
      value
    };
  } else if (isBoolean(value)) {
    return {
      type: NodeType.Boolean,
      loc: zero(),
      value
    };
  } else if (isDate(value)) {
    return {
      type: NodeType.DateTime,
      loc: zero(),
      raw: value.toISOString(),
      value
    };
  } else if (Array.isArray(value)) {
    return {
      type: NodeType.InlineArray,
      loc: zero(),
      items: value.map(value => {
        return {
          type: NodeType.InlineArrayItem,
          loc: zero(),
          item: walkValue(value),
          comma: true
        };
      })
    };
  } else {
    value = toJSON(value);
    if (!isObject(value)) return walkValue(value);

    return {
      type: NodeType.InlineTable,
      loc: zero(),
      items: walkObject(value).map(item => {
        return {
          type: NodeType.InlineTableItem,
          loc: item.loc,
          item,
          comma: true
        };
      })
    };
  }
}

function toJSON(value: any): any {
  return value && !isDate(value) && typeof value.toJSON === 'function' ? value.toJSON() : value;
}

function zero(): Location {
  return { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } };
}
