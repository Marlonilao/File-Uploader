import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';

export default defineConfig([
  { ignores: ['dist/**', 'src/generated/**'] },
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } },
  {
    // Files in public/ run in the browser, so document and window exist
    // there but the Node globals do not.
    files: ['src/public/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  eslintConfigPrettier,
]);
