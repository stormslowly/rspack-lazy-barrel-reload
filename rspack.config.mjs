import { rspack } from '@rspack/core';

// CONTROL=1 marks lib as having side effects, which turns the lazy barrel off.
const control = process.env.CONTROL === '1';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  entry: { main: './src/index.js' },
  mode: 'development',
  devtool: false,
  plugins: [new rspack.HtmlRspackPlugin()],
  module: {
    rules: control ? [{ test: /[\\/]src[\\/]lib[\\/]/, sideEffects: true }] : [],
  },
  lazyCompilation: true,
  devServer: {
    port: Number(process.env.PORT || 8765),
    hot: true,
    open: false,
  },
};
