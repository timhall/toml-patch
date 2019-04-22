import parseJS from '../parse-js';
import toTOML from '../to-toml';

const value = {
  a: '1',
  b: 2,
  c: 3.14,
  d: true,
  e: new Date('1979-05-27T07:32:00Z'),
  f: {
    g: ['h', 'i', 'j'],
    k: [
      { l: 'm' },
      {
        n: 'o',
        p: {
          toJSON() {
            return 'qrs';
          }
        }
      }
    ]
  },
  t: [{ u: 'v' }, { w: 'x' }, { y: 'z' }]
};

test('it should be properly formatted', () => {
  expect(toTOML(parseJS(value).items)).toMatchSnapshot();
  expect(
    toTOML(parseJS(value, { bracketSpacing: false, trailingComma: true }).items)
  ).toMatchSnapshot();
});
