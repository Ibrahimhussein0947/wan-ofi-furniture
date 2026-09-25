import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react/prop-types': 'off',
      // Apostrophes in JSX text render correctly; escaping them only hurts readability.
      'react/no-unescaped-entities': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true, caughtErrors: 'none' }],
      eqeqeq: ['error', 'always'],
      // Labels are associated through our Field component (htmlFor + generated ids).
      'jsx-a11y/label-has-associated-control': ['error', { controlComponents: ['Input', 'Select', 'Textarea', 'Checkbox'], assert: 'either', depth: 3 }],
      'jsx-a11y/no-autofocus': 'off',
    },
  },
  {
    files: ['src/test/**', 'vite.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
];
