module.exports = {
    presets: [
        '@babel/preset-react',
        '@babel/preset-typescript',
        '@babel/preset-env'
    ],
    plugins: [
      '@babel/plugin-transform-runtime',
      '@babel/plugin-proposal-class-properties'
    ]
  };