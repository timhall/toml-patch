import patch from '../patch';
import { parse } from '../';
import { example } from '../__fixtures__';

test('it should apply minimal patch', () => {
  const value = parse(example);

  // 1. Edit
  value.owner.name = 'Tim Hall';

  // 2a. Add (object)
  value.owner.handle = 'timhall';

  // 2b. Add (array)
  value.database.ports.push(8003);

  // 3a. Remove (object)
  delete value.database.enabled;

  // 3b. Remove (array)
  value.database.ports.splice(1, 1);

  // 4. Move
  value.clients.data[1][0] = 2;
  value.clients.data[1][1] = 1;

  // 5. Rename
  delete value.products[1].color;
  value.products[1].product_color = 'gray';

  expect(patch(example, value)).toMatchSnapshot();
});
