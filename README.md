# toml-patch

Patch, parse, and stringify TOML. 

## Installation

toml-patch is dependency-free and can be installed via npm or yarn.

```
$ npm install --save toml-patch
```

For browser usage, you can use unpkg:

```html
<script src="https://unpkg.com/toml-patch"></script>
```

## API

<a href="#patch" name="patch">#</a> <b>patch</b>(<i>existing</i>, <i>updated</i>)

Patch an existing TOML string with the given updated JS/JSON value, while attempting to retain the format of the existing document, including comments, indentation, and structure.

```js
const TOML = require('toml-patch');
const assert = require('assert');

const existing = `
# This is a TOML document

title = "TOML example"
owner.name = "Bob"
`
const patched = TOML.patch(existing, {
  title: 'TOML example',
  owner: {
    name: 'Tim'
  }
});

assert.strictEqual(patched, `
# This is a TOML document

title = "TOML example"
owner.name = "Tim"
`);
```

<a href="#parse" name="parse">#</a> <b>parse</b>(<i>value</i>)

Parse a TOML string into a JS/JSON value.

```js
const TOML = require('toml-patch');
const assert = require('assert');

const parsed = TOML.parse(`
# This is a TOML document.

title = "TOML Example"

[owner]
name = "Tim"`);

assert.deepStrictEqual(parsed, {
  title: 'TOML Example',
  owner: {
    name: 'Tim'
  }
});
```

<a href="#stringify" name="stringify">#</a> <b>stringify</b>(<i>value</i>[, <i>options</i>])

Convert a JS/JSON value to a TOML string. `options` can be provided for high-level formatting guidelines that follows prettier's configuration.

<b>options</b>

- `[printWidth = 80]` - (coming soon)
- `[trailingComma = false]` - Add trailing comma to inline tables
- `[bracketSpacing = true]` - `true`: `{ key = "value" }`, `false`: `{key = "value"}`

```js
const TOML = require('toml-patch');
const assert = require('assert');

const toml = TOML.stringify({
  title: 'TOML Example',
  owner: {
    name: 'Tim'
  }
});

assert.strictEqual(toml, 
`title = "TOML Example"

[owner]
name = "Tim"`);
```

## Development

[![Build Status](https://dev.azure.com/timhallengr/toml-patch/_apis/build/status/timhall.toml-patch?branchName=master)](https://dev.azure.com/timhallengr/toml-patch/_build/latest?definitionId=1&branchName=master)
