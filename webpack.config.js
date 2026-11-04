/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { version } = require('./package.json');

module.exports = {
    entry: {
        background: './src/background/index.ts',
        content: './src/content/index.ts',
        // Runs in the page's world to replace navigator.credentials; must stay
        // a separate bundle from `content` because the two live in different
        // JavaScript worlds.
        'webauthn-inject': './src/webauthn/inject.ts',
        'webauthn-bridge': './src/webauthn/bridge.ts',
        popup: './src/popup/index.tsx',
        vault: './src/vault/index.tsx',
        onboarding: './src/onboarding/index.tsx',
        // Argon2id runs here, off the background document's event loop, so
        // messaging (popup open, badge, unlock) never queues behind a derivation.
        'kdf-worker': './src/workers/kdf-worker.ts',
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        clean: true,
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.jsx'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
            },
        ],
    },
    plugins: [
        new webpack.DefinePlugin({
            __VW_VERSION__: JSON.stringify(version),
        }),
        new MiniCssExtractPlugin({ filename: '[name].css' }),
        new HtmlWebpackPlugin({
            template: './src/popup/index.html',
            filename: 'popup.html',
            chunks: ['popup'],
        }),
        new HtmlWebpackPlugin({
            template: './src/vault/index.html',
            filename: 'vault.html',
            chunks: ['vault'],
        }),
        new HtmlWebpackPlugin({
            template: './src/onboarding/index.html',
            filename: 'onboarding.html',
            chunks: ['onboarding'],
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'manifest.json', to: 'manifest.json' },
                {
                    from: 'public/icons',
                    to: 'icons',
                    // Named individually rather than globbed: public/icons also
                    // holds the 1024px source masters, the PWA's icons and the
                    // build script, and none of that belongs in the extension.
                    // The manifest references exactly these three.
                    filter: absolutePath => [
                        'icon16.png',
                        'icon48.png',
                        'icon128.png',
                    ].includes(path.basename(absolutePath)),
                },
            ],
        }),
    ],
    optimization: {
        splitChunks: false,
    },
};
