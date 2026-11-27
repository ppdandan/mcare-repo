import parser from '@typescript-eslint/parser';
import hooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['.next/**', '.expo/**', '.open-next/**', 'dist/**', 'android/**', 'ios/**'] },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': hooks },
    rules: {
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
