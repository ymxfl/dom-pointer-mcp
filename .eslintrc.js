module.exports = {
  root: true,
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'import'],
  settings: {
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.json', './packages/*/tsconfig.json'],
      },
    },
  },
  rules: {
    'class-methods-use-this': 'off',
    'no-await-in-loop': 'off',
  },
  overrides: [
    {
      files: ['packages/chrome-extension/**/*.ts'],
      globals: {
        chrome: 'readonly',
      },
      rules: {
        'no-restricted-globals': 'off',
      },
    },
  ],
};
