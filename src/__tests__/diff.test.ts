import diff from '../diff';

test('it should diff objects', () => {
  expect(
    diff(
      {
        a: 1,
        b: 3.14,
        c: 'd',
        e: true,
        f: [1, 2, 3],
        g: { h: 'i' }
      },
      {
        a: 2,
        b: 3.141,
        c: 'dd',
        e: false,
        f: [1, 2, 3, 4],
        g: { h: 'i', j: 'k' }
      }
    )
  ).toMatchSnapshot();
});

test('it should attempt to find moved array items', () => {
  expect(
    diff(
      [{ value: 1 }, { value: 2 }, { value: 3 }],
      [{ value: 4 }, { value: 3 }, { value: 2 }, { value: 5 }]
    )
  ).toMatchSnapshot();
});

test('it should compare dates by ISO', () => {
  expect(diff(new Date('1979-05-27T07:32:00Z'), new Date('1979-05-27T07:32:00Z'))).toEqual([]);
});
