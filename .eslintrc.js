module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto',
      },
    ],
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'error', // function having return datatype
    '@typescript-eslint/explicit-module-boundary-types': 'error', // argument having dtype
    '@typescript-eslint/no-explicit-any': 'error', // any là lỗi
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    // '@typescript-eslint/require-await': 'error',
    // 'prettier/prettier': ['error', { endOfLine: 'auto' }],
    // 'no-unused-vars': 'off',
    // '@typescript-eslint/no-unused-vars': ['error'],
    // 'no-console': [
    //   'error',
    //   {
    //     allow: ['warn', 'error', 'info'],
    //   },
    // ],
  },
};
