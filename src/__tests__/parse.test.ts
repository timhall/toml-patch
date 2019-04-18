import { parse } from '../';

test('it should parse example from readme', () => {
  const parsed = parse(`
# This is a TOML document.

title = "TOML Example"

[owner]
name = "Tim"`);

  expect(parsed).toEqual({
    title: 'TOML Example',
    owner: {
      name: 'Tim'
    }
  });
});
