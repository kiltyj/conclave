const crypto = require('crypto');
const path = require('path');

// Prevent use of insecure hash function without requiring legacy openssl provider
// From: https://stackoverflow.com/questions/69394632/webpack-build-failing-with-err-ossl-evp-unsupported#69691525
const origCreateHash = crypto.createHash;
crypto.createHash = (algorithm) => origCreateHash(algorithm === 'md4' ? 'sha256' : algorithm);

module.exports = {
  mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
  context: path.resolve(__dirname, 'lib'),
  entry: {
    main: './main.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'public/js'),
  },
  performance: {
    maxAssetSize: 1 * 1000 * 1000,
    maxEntrypointSize: 1 * 1000 * 1000,
  },
};