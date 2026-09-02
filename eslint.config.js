import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2020,
      // __BUILD_ID__ wstrzykuje Vite przez `define` — dla lintera to globalna stała.
      globals: { ...globals.browser, __BUILD_ID__: 'readonly' },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Rdzeń no-unused-vars NIE liczy użyć w nazwach elementów JSX (<motion.div>,
      // <Component/>) i zgłaszał je jako "nieużywane". Ta reguła to naprawia —
      // bez niej lista martwego kodu z lintera jest niewiarygodna.
      'react/jsx-uses-vars': 'error',
    },
  },
  // Node, nie browser: konfiguracja Vite + funkcje serverless Vercel w api/ (process, Buffer).
  {
    files: ['vite.config.js', 'api/**/*.js'],
    languageOptions: { globals: globals.node },
  },
])
