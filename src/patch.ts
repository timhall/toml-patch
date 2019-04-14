import parseTOML from './parse-toml';
import parseJS from './parse-js';
import toJS from './to-js';
import toTOML from './to-toml';
import { Format } from './format';
import { AST, Node, NodeType, KeyValue } from './ast';
import diff, { Change, ChangeType } from './diff';
import traverse, { Path, findByPath } from './traverse';

export default function patch(existing: string, updated: any, format?: Format): string {
  const existing_ast = parseTOML(existing);
  const existing_js = toJS(existing_ast);
  const updated_ast = parseJS(updated, format);

  const changes = diff(existing_js, updated);
  const patched_ast = applyChanges(existing_ast, updated_ast, changes);

  return toTOML(patched_ast);
}

function applyChanges(original: AST, updated: AST, changes: Change[]): AST {
  const search: Map<Change, Node> = new Map();
  changes.forEach(change => {
    const path = change.type === ChangeType.Add ? change.path.slice(0, -1) : change.path;
    const node = findByPath(original, path);

    search.set(change, node);
  });

  let current_path: string[] = [];
  traverse(original, {
    [NodeType.Table]: {
      enter(node) {
        current_path = current_path.concat(node.key.value.value);
        //
      },
      exit(node) {
        current_path = current_path.slice(0, -node.key.value.value.length);
        //
      }
    },
    [NodeType.InlineTable]: {
      enter(node) {
        //
      },
      exit(node) {
        //
      }
    },

    [NodeType.TableArray]: {
      enter(node) {
        //
      },
      exit(node) {
        //
      }
    },
    [NodeType.InlineTable]: {
      enter(node) {
        //
      },
      exit(node) {
        //
      }
    },

    [NodeType.KeyValue](node) {
      //
    }
  });

  return original;
}
