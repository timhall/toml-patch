import patch from '../patch';
import { parse } from '../';
import { example } from '../__fixtures__';

test('it should apply minimal patch', () => {
  const value = parse(example);
  value.owner.name = 'Tim Hall';

  expect(patch(example, value)).toMatchSnapshot();
});
