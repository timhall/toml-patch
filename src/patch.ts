import parseTOML from './parse-toml';
import parseJS from './parse-js';
import toJS from './to-js';
import toTOML from './to-toml';
import { Format } from './format';
import { AST } from './ast';
import diff, { Change } from './diff';

export default function patch(existing: string, updated: any, format?: Format): string {
  const existing_ast = parseTOML(existing);
  const existing_js = toJS(existing_ast);
  const updated_ast = parseJS(updated, format);

  const changes = diff(existing_js, updated);
  const patched_ast = applyChanges(existing_ast, updated_ast, changes);

  return toTOML(patched_ast);
}

function applyChanges(original: AST, updated: AST, changes: Change[]): AST {
  // TODO
  return original;
}
