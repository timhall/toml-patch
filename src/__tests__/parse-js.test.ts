import parseJS from '../parse-js';

test('it should parse object', () => {
  expect(
    parseJS({
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
      }
    })
  ).toMatchSnapshot();
});
