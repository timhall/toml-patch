import typescript from 'rollup-plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import dts from 'rollup-plugin-dts';
import filesize from 'rollup-plugin-filesize';

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/toml.es.js',
        format: 'es',
        sourcemap: true
      },
      {
        file: 'dist/toml.cjs.js',
        format: 'cjs',
        sourcemap: true
      }
    ],
    plugins: [typescript(), filesize()]
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/toml.umd.min.js',
      format: 'umd',
      name: 'toml',
      sourcemap: true
    },
    plugins: [typescript(), terser(), filesize()]
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/toml.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  }
];
