module.exports = {
  'env': {
    'es2021': true,
    'node': true
  },
  'extends': [
    'xo',
  ],
  'overrides': [
    {
      'extends': [
        'xo-typescript/space'
      ],
      'files': [
        '*.ts',
        '*.tsx'
      ],
      'parserOptions': {
        'project': './tsconfig.json'
      },
      'rules': {
        'capitalized-comments': 'off',
        '@typescript-eslint/naming-convention': 'off',
      }
    }
  ],
  'parserOptions': {
    'ecmaVersion': 'latest',
    'sourceType': 'module'
  },
  'rules': {
    'no-console': 'off',
    'max-len': ['error', {
      'code': 120,
    }]
  }
};
