import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'

export default defineConfig([
  globalIgnores(['public/**', 'node_modules/**', '.deploy*/**']),
  {
    files: ['**/*.{js,mjs}'],
    extends: [
      js.configs.recommended,
      stylistic.configs.customize({
        indent: 2,
        quotes: 'single',
        semi: false,
        commaDangle: 'never',
        arrowParens: false,
        jsx: false
      })
    ],
    linterOptions: {
      reportUnusedDisableDirectives: 'error'
    },
    rules: {
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      '@stylistic/brace-style': ['error', '1tbs'],
      '@stylistic/operator-linebreak': ['error', 'after', {
        overrides: { '?': 'before', ':': 'before' }
      }],
      '@stylistic/space-before-function-paren': ['error', 'always']
    }
  },
  {
    files: ['gulpfile.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node
    }
  },
  {
    files: ['eslint.config.mjs'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['source/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        GLOBAL_CONFIG: 'readonly',
        btf: 'readonly',
        saveToLocal: 'readonly'
      }
    }
  }
])
