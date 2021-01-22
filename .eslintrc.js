module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'plugin:vue/essential',
    '@vue/airbnb',
    '@vue/typescript/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    '@typescript-eslint/camelcase': 'off',
    'class-methods-use-this': 'off',
    'lines-between-class-members': 'off',
    'no-return-assign': 'off',
    '@typescript-eslint/no-namespace': 'off',
    'max-classes-per-file': 'off',
    'no-useless-constructor': 'off',
    'no-param-reassign': ['error', { "props": false }],
    'no-cond-assign': 'off',
  },
};
