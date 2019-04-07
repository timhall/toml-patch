import { tokenize } from '../tokenizer';

test('should tokenize simple input', () => {
  expect(tokenize(`a = "b"`)).toMatchSnapshot();
});

test('should tokenize multiline strings', () => {
  expect(
    tokenize(`
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
  ).toMatchSnapshot();
});

const complex = `# This is a TOML document.

title = "TOML Example"

[owner]
name = "Tom Preston-Werner"
dob = 1979-05-27T07:32:00-08:00 # First class dates

[database]
server = "192.168.1.1"
ports = [ 8001, 8001, 8002 ]
connection_max = 5000
enabled = true

[servers]

  # Indentation (tabs and/or spaces) is allowed but not required
  [servers.alpha]
  ip = "10.0.0.1"
  dc = "eqdc10"

  [servers.beta]
  ip = "10.0.0.2"
  dc = "eqdc10"

[clients]
data = [ ["gamma", "delta"], [1, 2] ]

# Line breaks are OK when inside arrays
hosts = [
  "alpha",
  "omega"
]

a.'b'."c" = "d"
date_space = 2018-01-01 08:00:00`;

test('should tokenize complex input', () => {
  expect(tokenize(complex)).toMatchSnapshot();
});
