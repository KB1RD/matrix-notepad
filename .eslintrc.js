module.exports = {
  root: true,
  env: {
    browser: true,
    node: true
  },
  parserOptions: {
    parser: 'babel-eslint'
  },
  extends: [
    '@nuxtjs',
    'prettier',
    'prettier/vue',
    'plugin:prettier/recommended',
    'plugin:nuxt/recommended'
  ],
  plugins: [
    'prettier'
  ],
  rules: {
    // See https://github.com/KB1RD/matrix-notepad/wiki/Program-Organization
    camelcase: 'off',
    // I want the ability to order attributes as I see fit. For example, I
    // think it makes sense to put the 'title' attribute of a panel first
    // to improve readability.
    'vue/attributes-order': 'off'
  }
}
