/* eslint-env node */
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'prettier',
    ],
    rules: {
        'no-console': ['error', { allow: ['error'] }],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-unused-vars': [
            'error',
            { argsIgnorePattern: '^_' },
        ],
        'no-duplicate-imports': 'error',
        '@typescript-eslint/consistent-type-assertions': [
            'error',
            { assertionStyle: 'never' },
        ],
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-non-null-assertion': 'error',
    },
    // jest rules
    overrides: [
        {
            files: ['**/*-test.ts'],
            env: {
                jest: true,
            },
            plugins: ['jest'],
            extends: ['plugin:jest/recommended'],
        },
    ],
};
