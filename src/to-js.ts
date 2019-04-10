import { Document, Value, isValue } from './ast';
import traverse from './traverse';

export default function toJS(document: Document | Value): any {
  // TODO
  if (isValue(document)) {
    return '';
  }

  traverse(document, {});

  return {};
}
