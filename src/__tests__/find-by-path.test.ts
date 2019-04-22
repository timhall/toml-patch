import findByPath from '../find-by-path';
import parseTOML from '../parse-toml';
import { example } from '../__fixtures__';
import { Document, NodeType } from '../ast';

it('should find node by path', () => {
  const ast = parseTOML(example);
  const document: Document = {
    type: NodeType.Document,
    loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
    items: [...ast]
  };

  expect(findByPath(document, []).type).toEqual('Document');
  expect((findByPath(document, ['title']) as any).value.value).toEqual('TOML Example');
  expect((findByPath(document, ['owner', 'organization']) as any).value.value).toEqual('GitHub');
  expect((findByPath(document, ['database', 'ports', 2]) as any).value).toEqual(8002);
  expect((findByPath(document, ['products', 1, 'name']) as any).value.value).toEqual('Nail');
});
