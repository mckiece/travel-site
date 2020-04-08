const currentTask = process.env.npm_lifecycle_event;
const path = require('path');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
// this allows us to manage multiple html files
const fse = require('fs-extra');

const postCSSPlugins = [
	require('postcss-import'),
	require('postcss-mixins'),
	require('postcss-simple-vars'),
	require('postcss-nested'),
	require('postcss-hexrgba'),
	require('autoprefixer')
];

// this class is setup to be generic but we're specifically using it to collect images for production
class RunAfterCompile {
	apply(compiler) {
		compiler.hooks.done.tap('Copy images', function() {
			// use fse again to copy images from dev folders to dist (docs for GitHub) folder
			fse.copySync('./app/assets/images', './docs/assets/images');
		});
	}
}

let cssConfig = {
	test: /\.css$/i,
	use: ['css-loader?url=false', {loader: 'postcss-loader', options: {plugins: postCSSPlugins}}]
}

// html plugin allows us to use both dev and build correctly, specifying what the file name should be and where to look for the original file
// fse.readdirSync('./app') is going to return an array of all of the files in the app folder
// we'll use filter to only get files that end in html
let pages = fse.readdirSync('./app').filter(function(file){
	// with this anon function, we set the filter for html files
	return file.endsWith('.html');
// map will create a new array out of the previous array
}).map(function(page) {
	// this is the html plugin we're applying to each page, it's configured with an object
	// filename is what name to write the file to, template is the path for the file
	return new HtmlWebpackPlugin({
		filename: page,
		template: `./app/${page}`
	});
});

let config = {
	entry: './app/assets/scripts/App.js',
	plugins: pages,
	module: {
		rules: [
			cssConfig
		]
	}
};

if (currentTask == 'dev') {
	// adding this to the loader rules array
	cssConfig.use.unshift('style-loader');
	config.output = {
		filename: 'bundled.js',
		path: path.resolve(__dirname, 'app')
	};
	config.devServer = {
		before: function(app, server) {
			server._watch('./app/**/*.html')
		},
		contentBase: path.join(__dirname, 'app'),
		hot: true,
		port: 3000,
		host: '0.0.0.0'
	};
	config.mode = 'development';
}

if (currentTask == 'build') {
	// pushing a new rule onto the rules array
	config.module.rules.push({
		// this only applies this to js files
		test: /\.js$/,
		// we want it to ignore the node modules files
		exclude: /(node_modules)/,
		// this allows the js to work in a wider variety of browsers
		use: {
			loader: 'babel-loader',
			options: {
				presets: ['@babel/preset-env']
			}
		}
	});
	// adding the mini css loader here only, just need it for builds
	cssConfig.use.unshift(MiniCssExtractPlugin.loader);
	// add cssnano to the end of the plugin array, only needed for build, not dev to minify
	postCSSPlugins.push(require('cssnano'));
	config.output = {
		filename: '[name].[chunkhash].js',
		chunkFilename: '[name].[chunkhash].js',
		path: path.resolve(__dirname, 'docs')
	};
	config.mode = 'production';
	config.optimization = {
		splitChunks: {chunks: 'all'}
	}
	// pushing these plugins into the main plugin array
	// cleanwebpack deletes everything in the dist (docs for GitHub) folder
	// in mini css, we're specifying the file name because we want fine control
	config.plugins.push(new CleanWebpackPlugin(),
	new MiniCssExtractPlugin({filename: 'styles.[chunkhash].css'}),
	// used for adding images to dist (docs for GitHub) folder
	new RunAfterCompile()
	);
}

module.exports = config;