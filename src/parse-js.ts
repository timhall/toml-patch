import {
  NodeType,
  Document,
  Value,
  KeyValue,
  Integer,
  Float,
  DateTime,
  Boolean,
  InlineArray,
  InlineTable,
  InlineArrayItem,
  InlineTableItem,
  Key,
  String as StringNode
} from './ast';
import { Position } from './location';
import { Format, formatTopLevel, formatPrintWidth } from './format';
import { isObject, isString, isInteger, isFloat, isBoolean, isDate, last, pipe } from './utils';

interface Options {
  start: Position;
  format: Format;
}

const default_format = {
  printWidth: 80,
  trailingComma: false,
  bracketSpacing: true
};

const IS_BARE_KEY = /[\w,\d,\_,\-]+/;

export default function parseJS(value: any, format: Format = {}): Document | Value {
  format = Object.assign({}, default_format, format);

  value = toJSON(value);
  if (!isObject(value)) return walkValue(value, { start: zero(), format });

  // Heuristics:
  // 1. Top-level objects/arrays should be tables/table arrays
  // 2. Convert objects/arrays to tables/table arrays based on print width
  let body = pipe(
    walkObject(value, { start: zero(), format }),
    formatTopLevel,
    body => formatPrintWidth(body, format)
  );

  return {
    type: NodeType.Document,
    loc: { start: zero(), end: body.length ? last(body)!.loc.end : zero() },
    body
  };
}

function walkObject(value: any, options: Options): KeyValue[] {
  let { start, format } = options;
  return Object.keys(value).map(key => {
    const key_value = asKeyValue(key, value[key], { start, format });

    // Move start position to start of next line
    start = { line: key_value.loc.end.line + 1, column: 0 };

    return key_value;
  });
}

function walkObjectInline(value: any, options: Options): InlineTableItem[] {
  let { start, format } = options;
  return Object.keys(value).map((key: string, index: number, keys: string[]) => {
    const is_last = index === keys.length - 1;
    const key_value = asKeyValue(key, value[key], { start, format });

    // Move start position to after this item
    start = { line: start.line, column: key_value.loc.end.column + 2 };

    return {
      type: NodeType.InlineTableItem,
      loc: key_value.loc,
      item: key_value,
      comma: !is_last || format.trailingComma ? true : false
    };
  });
}

function walkValue(value: any, options: Options): Value {
  if (value == null) {
    throw new Error('"null" and "undefined" values are not supported');
  }

  if (isString(value)) {
    return asString(value, options);
  } else if (isInteger(value)) {
    return asInteger(value, options);
  } else if (isFloat(value)) {
    return asFloat(value, options);
  } else if (isBoolean(value)) {
    return asBoolean(value, options);
  } else if (isDate(value)) {
    return asDateTime(value, options);
  } else if (Array.isArray(value)) {
    return asInlineArray(value, options);
  } else {
    return asInlineTable(value, options);
  }
}

function asKeyValue(key: string, value: any, options: Options): KeyValue {
  const { start, format } = options;
  const raw = IS_BARE_KEY.test(key) ? key : JSON.stringify(key);

  const key_node: Key = {
    type: NodeType.Key,
    loc: {
      start,
      end: { line: start.line, column: start.column + raw.length }
    },
    raw,
    value: [key]
  };

  const equals = key_node.loc.end.column + 1;
  const value_start = { line: start.line, column: equals + 2 };
  const value_node = walkValue(value, { start: value_start, format });

  return {
    type: NodeType.KeyValue,
    loc: { start, end: value_node.loc.end },
    key: key_node,
    value: value_node,
    equals
  };
}

function asString(value: any, options: Options): StringNode {
  const { start } = options;
  const raw = JSON.stringify(value);

  return {
    type: NodeType.String,
    loc: {
      start,
      end: { line: start.line, column: start.column + raw.length }
    },
    raw,
    value: value as string
  };
}

function asInteger(value: any, options: Options): Integer {
  const { start } = options;
  const raw = String(value);

  return {
    type: NodeType.Integer,
    loc: {
      start,
      end: { line: start.line, column: start.column + raw.length }
    },
    raw,
    value
  };
}

function asFloat(value: any, options: Options): Float {
  const { start } = options;
  const raw = String(value);

  return {
    type: NodeType.Float,
    loc: {
      start,
      end: { line: start.line, column: start.column + raw.length }
    },
    raw,
    value
  };
}

function asBoolean(value: any, options: Options): Boolean {
  const { start } = options;
  const raw = String(value);

  return {
    type: NodeType.Boolean,
    loc: {
      start,
      end: { line: start.line, column: start.column + raw.length }
    },
    value: value as boolean
  };
}

function asDateTime(value: any, options: Options): DateTime {
  const { start } = options;
  const raw = value.toISOString();

  return {
    type: NodeType.DateTime,
    loc: {
      start,
      end: { line: start.line, column: start.column + raw.length }
    },
    raw,
    value
  };
}

function asInlineArray(value: any, options: Options): InlineArray {
  const { start, format } = options;
  const leading_spacing = format.bracketSpacing ? 1 : 0;
  const trailing_spacing = leading_spacing + (format.trailingComma ? 1 : 0);

  let item_start = { line: start.line, column: start.column + 1 + leading_spacing };
  const items: InlineArrayItem[] = value.map((value: any, index: number, values: any[]) => {
    const item = walkValue(value, { start: item_start, format });
    const is_last = index === values.length - 1;

    item_start = { line: item.loc.end.line, column: item.loc.end.column + 2 };

    return {
      type: NodeType.InlineArrayItem,
      loc: item.loc,
      item,
      comma: !is_last || format.trailingComma ? true : false
    };
  });

  const end = items.length
    ? {
        line: last(items)!.loc.end.line,
        column: last(items)!.loc.end.column + 1 + trailing_spacing
      }
    : { line: start.line, column: start.column + 1 };

  return {
    type: NodeType.InlineArray,
    loc: { start, end },
    items
  };
}

function asInlineTable(value: any, options: Options): InlineTable | Value {
  value = toJSON(value);
  if (!isObject(value)) return walkValue(value, options);

  const { start, format } = options;
  const line = start.line;
  const leading_spacing = format.bracketSpacing ? 1 : 0;
  const trailing_spacing = leading_spacing + (format.trailingComma ? 1 : 0);

  let item_start = { line, column: start.column + 1 + leading_spacing };
  const items: InlineTableItem[] = walkObjectInline(value, { start: item_start, format });

  const end = items.length
    ? { line, column: last(items)!.loc.end.column + 1 + trailing_spacing }
    : { line, column: start.column + 2 };

  return {
    type: NodeType.InlineTable,
    loc: { start, end },
    items
  };
}

function toJSON(value: any): any {
  return value && !isDate(value) && typeof value.toJSON === 'function' ? value.toJSON() : value;
}

function zero(): Position {
  return { line: 1, column: 0 };
}
