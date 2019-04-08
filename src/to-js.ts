import { Document } from './ast';
import traverse from './traverse';

export default function toJS(document: Document): any {
  // TODO
  traverse(document, {});

  return {};
}
