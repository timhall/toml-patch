import typescript from 'rollup-plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import dts from 'rollup-plugin-dts';
import filesize from 'rollup-plugin-filesize';
import pkg from './package.json';

const banner = `//! ${pkg.name} v${pkg.version} - ${pkg.homepage} - @license: ${pkg.license}`;

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/toml-patch.es.js',
        format: 'es',
        banner
      }
    ],
    plugins: [typescript(), filesize()]
  },
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/toml-patch.cjs.min.js',
        format: 'cjs',
        sourcemap: true,
        banner
      },
      {
        file: 'dist/toml-patch.umd.min.js',
        format: 'umd',
        name: 'TOML',
        sourcemap: true,
        banner
      }
    ],
    plugins: [typescript(), terser(), filesize()]
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/toml-patch.d.ts',
      format: 'es',
      banner
    },
    plugins: [dts()]
  }
];
