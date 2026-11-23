import nextVitals from 'eslint-config-next/core-web-vitals'

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...nextVitals,
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**'],
  },
]

export default eslintConfig
