import { stringify } from '../';

test('should stringify example from readme', () => {
  const toml = stringify({
    title: 'TOML Example',
    owner: {
      name: 'Tim'
    }
  });

  expect(toml).toEqual(
    `title = "TOML Example"

[owner]
name = "Tim"
`
  );
});
