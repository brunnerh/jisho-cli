import * as path from 'path';
import { Configuration, BannerPlugin } from 'webpack';
import nodeExternals from 'webpack-node-externals';

const config = <Configuration>{
	mode: 'production',
	devtool: "source-map",
	target: "node",
	entry: path.resolve(__dirname, './src/jisho.ts'),
	output: {
		path: path.resolve(__dirname, 'out'),
		filename: 'jisho.js'
	},
	resolve: {
		extensions: [".ts", ".js"],
	},
	module: {
		rules: [
			{
				include: /\.ts$/,
				loader: 'ts-loader',
				options: { configFile: path.resolve(__dirname, './src/tsconfig.json') }
			}
		]
	},
	plugins: [
		new BannerPlugin({
			banner: '#!/usr/bin/env node',
			raw: true,
		})
	],
    externalsPresets: { node: true },
	externals: [nodeExternals({
		allowlist: 'ansi-es6'
	})],
}

module.exports = config;
