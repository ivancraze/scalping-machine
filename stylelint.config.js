export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['dist/**', 'node_modules/**'],
  overrides: [
    {
      files: ['**/*.module.scss'],
      rules: { 'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }] },
    },
  ],
  rules: {
    'selector-class-pattern': null,
    'custom-property-pattern': null,
    'at-rule-empty-line-before': null,
    'media-feature-range-notation': null,
    'no-descending-specificity': null,
    'no-duplicate-selectors': null,
    'rule-empty-line-before': null,
    'selector-pseudo-element-colon-notation': null,
    'color-hex-length': null,
  },
};
