import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import security from 'eslint-plugin-security';

export default [
  js.configs.recommended,
  security.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        FormData: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        // React
        React: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      'no-unused-vars': 'off',
      // セキュリティ関連の追加ルール
      'security/detect-object-injection': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'error',
      'security/detect-pseudoRandomBytes': 'warn',
      'security/detect-unsafe-regex': 'error',
    },
  },
  {
    files: ['api/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        // Browser globals for scripts that might need them
        URL: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      // Node.jsファイルでのセキュリティルール強化
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-require': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-child-process': 'warn',
    },
  },
  {
    files: ['app/lib/db/*.ts', 'app/lib/utils/dataMerging.ts'],
    rules: {
      'security/detect-object-injection': 'off', // DB操作での安全なオブジェクトアクセス
    },
  },
  {
    files: ['app/hooks/common/useFilters.ts'],
    rules: {
      'security/detect-object-injection': 'off', // 型安全なフィルター操作
    },
  },
  {
    files: ['e2e/**/*.spec.ts'],
    rules: {
      'security/detect-non-literal-regexp': 'off', // テストでの動的正規表現は許容
    },
  },
  {
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off', // スクリプトでの動的ファイル操作は許容
    },
  },
  {
    files: ['api/**/*.js'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off', // APIでのビルド時ファイル解決は許容
    },
  },
  {
    files: ['app/lib/identityStorage.ts'],
    rules: {
      'security/detect-non-literal-regexp': 'off', // ストレージでの動的正規表現は安全
    },
  },
  {
    files: ['app/components/**/*.tsx'],
    rules: {
      'security/detect-object-injection': 'off', // Reactコンポーネントでの安全なプロパティアクセス
    },
  },
  {
    ignores: [
      'build/',
      'coverage/',
      'node_modules/',
      '.react-router/',
      'playwright-report/',
      'test-results/',
    ],
  },
];
