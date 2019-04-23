import { tokenize } from '../tokenizer';
import { example } from '../__fixtures__';

test('should tokenize simple input', () => {
  expect([...tokenize(`a = "b"`)]).toMatchSnapshot();
});

test('should tokenize multiline strings', () => {
  expect([
    ...tokenize(`
    a = "b"
    c = 'd'
    e = """
      f
    """
    g = '''
      h
    '''
    "i".'j'.k = "l"
  `)
  ]).toMatchSnapshot();
});

test('should tokenize dotted key with spaces', () => {
  expect([...tokenize(`[[ a . "b" . 'c' ]]`)]).toMatchSnapshot();
});

test('should tokenize complex input', () => {
  expect([...tokenize(example)]).toMatchSnapshot();
});

test('should handle escaped solidus', () => {
  expect([...tokenize(`a = "\\\\"`)]).toMatchSnapshot();
});
