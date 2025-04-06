// eslint-disable-next-line
const FileManagerPlugin = require("filemanager-webpack-plugin");

/** @type {import('webpack').Configuration} */
module.exports = {
  entry: {
    extension: "./client/extension.ts",
    cli: "./src/cli.ts",
  },
  output: {
    path: __dirname + "/out",
    clean: true,
    libraryTarget: "commonjs2",
  },
  target: "node",
  mode: "production",
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.wasm$/,
        use: "file-loader",
      },
    ],
  },
  plugins: [
    new FileManagerPlugin({
      events: {
        onEnd: {
          copy: [
            {
              source: "./node_modules/web-tree-sitter/tree-sitter.wasm",
              destination: "./out/tree-sitter.wasm",
            },
          ],
        },
      },
    }),
  ],
  resolve: {
    extensions: [".ts", ".js", ".wasm"],
  },
  externals: ["vscode"],
};
