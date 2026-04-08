import eslint from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      // The sacred rule
      '@stylistic/space-before-function-paren': ['error', 'always'],

      // Other stylistic preferences
      '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
      '@stylistic/block-spacing': ['error', 'always'],
      '@stylistic/brace-style': ['error', '1tbs'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/comma-spacing': ['error', { before: false, after: true }],
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/func-call-spacing': ['error', 'never'],
      '@stylistic/indent': ['error', 2],
      '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true, mode: 'strict' }],
      '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
      '@stylistic/no-multi-spaces': 'error',
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/object-property-newline': 'error',
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/semi': ['error', 'never'],

      // Non-stylistic rules
      'curly': ['error', 'all'],
      'default-case': 'error',
      'dot-notation': 'error',
      'eqeqeq': ['error', 'always'],
      'no-empty-function': 'error',
      'no-sequences': 'error',
      'yoda': ['error', 'never'],
    },
  },
)
