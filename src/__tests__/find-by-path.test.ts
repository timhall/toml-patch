import findByPath from '../find-by-path';
import parseTOML from '../parse-toml';
import { example } from '../__fixtures__';

it('should find node by path', () => {
  const ast = parseTOML(example);

  expect(findByPath(ast, []).type).toEqual('Document');
  expect((findByPath(ast, ['title']) as any).value.value).toEqual('TOML Example');
  expect((findByPath(ast, ['owner', 'organization']) as any).value.value).toEqual('GitHub');
  expect((findByPath(ast, ['database', 'ports', 2]) as any).value).toEqual(8002);
  expect((findByPath(ast, ['products', 1, 'name']) as any).value.value).toEqual('Nail');
});
