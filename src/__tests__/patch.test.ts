import patch from '../patch';
import { parse } from '../';
import { example } from '../__fixtures__';

test('it should apply edit to key-value', () => {
  const value = parse(example);
  value.owner.name = 'Tim Hall';

  expect(patch(example, value)).toMatchSnapshot();
});

test('it should add key-value to table', () => {
  const value = parse(example);
  value.owner.handle = 'timhall';

  expect(patch(example, value)).toMatchSnapshot();
});

test('it should add key-value to inline table', () => {
  const value = parse(example);
  value.clients.count.d = 4;

  expect(patch(example, value)).toMatchSnapshot();
});

test('it should add to inline array', () => {
  const value = parse(example);
  value.database.ports.push(8003);

  expect(patch(example, value)).toMatchSnapshot();
});

test('it should add to table array', () => {
  const value = parse(example);
  value.products.splice(1, 0, { name: 'Screwdriver', sku: 123456 });

  expect(patch(example, value)).toMatchSnapshot();
});

test('should remove key-value from table', () => {
  const value = parse(example);
  delete value.database.enabled;

  expect(patch(example, value)).toMatchSnapshot();
});

test('should remove element from inline array', () => {
  const value = parse(example);
  value.database.ports.splice(1, 1);

  expect(patch(example, value)).toMatchSnapshot();
});

test('should move elements in inline array', () => {
  const value = parse(example);
  value.clients.data[1][0] = 2;
  value.clients.data[1][1] = 1;

  expect(patch(example, value)).toMatchSnapshot();
});

test('should rename key-value in table', () => {
  const value = parse(example);
  delete value.products[1].color;
  value.products[1].product_color = 'gray';

  expect(patch(example, value)).toMatchSnapshot();
});

test('should patch readme example', () => {
  const existing = `
# This is a TOML document

title = "TOML example"
owner.name = "Bob"
`;
  const patched = patch(existing, {
    title: 'TOML example',
    owner: {
      name: 'Tim'
    }
  });

  expect(patched).toEqual(`
# This is a TOML document

title = "TOML example"
owner.name = "Tim"
`);
});
