const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/index.ts',
  optimization: {
    minimize: false,
  },
  target: 'webworker',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.js$/,
        type: 'javascript/auto',
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    extensionAlias: {
      '.js': ['.js', '.ts'],
    },
    fullySpecified: false,
    mainFields: ['module', 'main'],
    fallback: {
      events: require.resolve('events/'),
    },
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
  },
  externals: [
    ({ request }, callback) => {
      if (/^fastly:.*$/.test(request)) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    },
  ],
  mode: 'production',
  plugins: [new webpack.NormalModuleReplacementPlugin(/^node:events$/, require.resolve('events/'))],
};
