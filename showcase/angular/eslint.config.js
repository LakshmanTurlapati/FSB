// Phase 261 / CI-03 -- ESLint v9 flat config for the showcase Angular project.
// Two rule blocks: TypeScript and HTML templates. The template/i18n rule is
// scoped to **/*.html only; meaningless on TS files and would produce noise.
// Defaults for checkId / checkText / checkAttributes are already true per the
// rule docs; explicit declaration documents the CI-03 locked decision in-source.
// Source: github.com/angular-eslint/angular-eslint blob CONFIGURING_FLAT_CONFIG.md
// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {},
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {
      // CONTEXT lock + CI-03: enforce marked strings + custom IDs (@@) + attribute coverage.
      // Defaults are already true; explicit for self-documentation.
      '@angular-eslint/template/i18n': ['error', {
        checkId: true,
        checkText: true,
        checkAttributes: true
      }]
    }
  }
);
