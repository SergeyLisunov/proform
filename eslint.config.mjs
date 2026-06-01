// W21 audit fix (task 5): ESLint flat config (eslint 9).
//
// Why: Next 16 removed `next lint`, and eslint-config-next 16 ships NATIVE flat
// config (eslint 9) — it no longer works with eslint 8 + .eslintrc, and even
// FlatCompat can't bridge it (its plugin objects are circular → the eslintrc
// validator throws "Converting circular structure to JSON"). So the old
// `npm run lint` (= `next lint` + .eslintrc.json) was fully broken — ESLint
// Layer 1 was effectively off. This restores it by consuming the flat config
// directly.
//
// `eslint-config-next/core-web-vitals` exports a flat-config array
// ([...base, @next/eslint-plugin-next core-web-vitals]). We spread it and add
// the project's @typescript-eslint/no-redeclare rule (the W13 ghost-merge guard).
//
// Run: `npm run lint` (= `eslint .`). NOTE: surfaces pre-existing lint debt
// (react-hooks/rules-of-hooks in app/org/health + app/coach/passes,
// react/no-unescaped-entities). Fixing those + flipping the build gate is the
// separate "ESLint gate enable" task — this one only makes the linter runnable.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // W13 ghost-merge guard. @typescript-eslint plugin is registered by the
    // eslint-config-next/typescript flat config spread above.
    rules: {
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
      // QA M6: eslint-config-next/typescript enables no-explicit-any as an ERROR,
      // but the legacy `next/core-web-vitals` setup never enforced it — the project
      // intentionally uses `any` for Supabase query casts (the generated Database
      // types don't cover every embed/RPC shape). 324 of these aren't real defects;
      // erroring on them makes `npm run lint` noise devs ignore. Downgrade to a
      // warning so the genuine debt (rules-of-hooks, unescaped entities) stays visible.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]

export default config
