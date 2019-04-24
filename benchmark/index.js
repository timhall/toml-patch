const { join, basename } = require('path');
const { readFileSync } = require('fs');
const { Suite, formatNumber } = require('benchmark');
const { sync: glob } = require('glob');
const mri = require('mri');

const { help, example, reference, _: filter } = mri(process.argv.slice(2), {
  boolean: ['help', 'example', 'reference']
});

if (help) {
  console.log(`Run benchmarks for toml-patch
  
Usage: node benchmark <filter> [options]

Options:
  <filter>      Filter benchmarks
  --example     Just run benchmark for spec example
  --reference   Run benchmarks for @iarna/toml`);
}

const TOML = reference ? require('../submodules/iarna-toml') : require('../');
const search = example ? '0A-spec-01-example-v0.4.0.toml' : `${filter ? `*${filter}*` : '*'}.toml`;

const benchmark_dir = join(__dirname, '../submodules/iarna-toml/benchmark');
const benchmarks = glob(join(benchmark_dir, search)).map(path => {
  const name = basename(path, '.toml');
  const data = readFileSync(path, 'utf8');

  return { name, data };
});

if (!benchmarks.length) {
  throw new Error(`No matching benchmarks found for ${example ? '--example' : filter}`);
}

const suite = new Suite('toml-patch');
benchmarks.forEach(({ name, data }) => {
  suite.add(name, () => TOML.parse(data));
});

suite
  .on('start', () => {
    console.log(`Benchmark: ${reference ? '@iarna/toml' : 'toml-patch'}`);

    if (example || search) {
      const count = benchmarks.length;
      const filter_text = example ? '--example' : `"${filter}"`;

      console.log(`Filter: ${filter_text} -> ${count} ${count === 1 ? 'benchmark' : 'benchmarks'}`);
    }
  })
  .on('cycle', event => {
    console.log(String(event.target));
  })
  .on('complete', event => {
    const suite = event.currentTarget;
    if (!suite.length) return;

    const hz = suite.reduce((total, benchmark) => total + benchmark.hz, 0) / suite.length;

    console.log();
    console.log(`toml-patch x ${formatNumber(hz.toFixed(hz < 100 ? 2 : 0))} ops/sec`);
  })
  .run();
