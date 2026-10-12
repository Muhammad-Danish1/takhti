import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/*
 * The lint rules of the repository. Two kinds:
 *
 *   Layer boundaries   which package may import which. A wrong import fails here long before it
 *                      could ship: a screen that reaches into the database, a contract that
 *                      depends on the server.
 *   Project rules      the conventions that keep money, time and the theme right.
 *
 * Every rule below has a test in tests/lint/rules.test.ts that feeds it a deliberately wrong file.
 */

const packages = ['contracts', 'db', 'core', 'api-client', 'hooks', 'ui', 'worker'];
const workspace = (names) => names.map((name) => `@takhti/${name}`);
const withSubpaths = (names) => names.flatMap((name) => [name, `${name}/*`]);

/** `no-restricted-imports` options that forbid whole packages, with one message. */
const forbid = (names, message, extra = {}) => ({
  patterns: [{ group: withSubpaths(names), message }],
  ...extra,
});

const serverOnly = [
  'drizzle-orm',
  'postgres',
  'pino',
  'pino-pretty',
  '@electric-sql/pglite',
  '@supabase/supabase-js',
];
const browserOnly = ['react', 'react-dom', 'next', '@tanstack/react-query'];

/** Only these files may reach the privileged connection. docs/plan/00-foundation/07-backend-kernel.md lists why each one must. */
const mayUsePrivilegedConnection = [
  'packages/db/**',
  'packages/core/src/kernel/context.ts',
  'packages/core/src/kernel/permissions.ts',
  'packages/core/src/kernel/session.ts',
  'packages/core/src/kernel/rate-limit.ts',
  'packages/core/src/kernel/jobs.ts',
  'packages/core/src/kernel/idempotency.ts',
  'packages/core/src/modules/platform/**',
  'tests/**',
  '**/*.test.ts',
];

const privilegedConnection = {
  name: '@takhti/db',
  importNames: ['adminDb', 'withAdminTx'],
  message:
    'The privileged connection skips row-level security. Use ctx.db. Only the kernel files listed in the ESLint config may import it.',
};

/** The clock is read in one place; everything else receives `ctx.now` and `ctx.today`. */
const noClock = [
  {
    selector: "NewExpression[callee.name='Date']",
    message:
      'Do not create Date objects here. Use ctx.now / ctx.today and the functions in kernel/dates.ts, so time is testable and always Pakistan time.',
  },
];

/** A heuristic, since lint cannot see types: arithmetic on something named like money belongs in kernel/money.ts. */
const moneyName =
  '/(amount|paisa|price|balance|salary|fine|fee|total|discount|arrears|credit|debit)s?$/i';
const noMoneyMaths = [
  {
    selector: `BinaryExpression[operator=/^[*\\/%]$/] > Identifier[name=${moneyName}]`,
    message:
      'Do not multiply or divide money directly: floating point drifts. Use percentOf, times, fraction or allocate from kernel/money.ts.',
  },
  {
    selector: `BinaryExpression[operator=/^[*\\/%]$/] > MemberExpression > Identifier.property[name=${moneyName}]`,
    message:
      'Do not multiply or divide money directly: floating point drifts. Use percentOf, times, fraction or allocate from kernel/money.ts.',
  },
];

/** The theme is logical (it mirrors for Urdu) and square. */
const physicalDirection =
  '/(^|\\s)(-?m[lr]|p[lr]|left|right|border-[lr]|scroll-m[lr]|scroll-p[lr])-|(^|\\s)(text-(left|right)|float-(left|right))(\\s|$)/';
const roundedCorner = '/(^|\\s)rounded(-(?!none(\\s|$))[a-z0-9\\[\\]\\.]+)*(\\s|$)/';
const themeRules = [
  {
    selector: `JSXAttribute[name.name='className'] Literal[value=${physicalDirection}]`,
    message:
      'Use logical classes (ms-, me-, ps-, pe-, start-, end-, text-start, text-end) so the layout mirrors for Urdu.',
  },
  {
    selector: `JSXAttribute[name.name='className'] TemplateElement[value.raw=${physicalDirection}]`,
    message:
      'Use logical classes (ms-, me-, ps-, pe-, start-, end-, text-start, text-end) so the layout mirrors for Urdu.',
  },
  {
    selector: `JSXAttribute[name.name='className'] Literal[value=${roundedCorner}]`,
    message: 'The Kashi theme has square corners everywhere. Remove the rounded class.',
  },
  {
    selector: `JSXAttribute[name.name='className'] TemplateElement[value.raw=${roundedCorner}]`,
    message: 'The Kashi theme has square corners everywhere. Remove the rounded class.',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/dist/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'packages/db/migrations/**',
      'docs/**',
      'supabase/**',
      '.test-db/**',
    ],
  },

  ...tseslint.configs.strict,

  {
    files: ['**/*.{ts,tsx,mts,mjs,js,cjs}'],
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-console': 'error',
      'no-debugger': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-restricted-imports': ['error', { paths: [privilegedConnection] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],
      // A class with only static members is how some kernel helpers read best.
      '@typescript-eslint/no-extraneous-class': 'off',
      // Generic factories in the kernel legitimately use `{}` for "no extra filters".
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  // ----------------------------------------------------------------------------- layer boundaries

  {
    files: ['packages/contracts/src/**'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: withSubpaths(workspace(packages)),
              message: 'Contracts are the bottom layer: they import nothing from the workspace.',
            },
            {
              group: withSubpaths([...serverOnly, ...browserOnly]),
              message: 'Contracts run everywhere (server, browser, phone): only zod is allowed.',
            },
            {
              group: ['node:*'],
              message: 'Contracts run in the browser and on phones: no Node.js modules.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/db/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        forbid(
          [...workspace(['core', 'api-client', 'hooks', 'ui', 'worker']), ...browserOnly],
          'The database layer imports contracts only.',
        ),
      ],
    },
  },
  {
    files: ['packages/core/src/**'],
    ignores: mayUsePrivilegedConnection,
    rules: {
      'no-restricted-imports': [
        'error',
        forbid(
          [...workspace(['api-client', 'hooks', 'ui', 'worker']), ...browserOnly],
          'The service layer imports contracts and db only.',
          { paths: [privilegedConnection] },
        ),
      ],
    },
  },
  {
    files: [
      'packages/core/src/kernel/context.ts',
      'packages/core/src/kernel/permissions.ts',
      'packages/core/src/kernel/session.ts',
      'packages/core/src/kernel/rate-limit.ts',
      'packages/core/src/kernel/jobs.ts',
      'packages/core/src/kernel/idempotency.ts',
      'packages/core/src/modules/platform/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        forbid(
          [...workspace(['api-client', 'hooks', 'ui', 'worker']), ...browserOnly],
          'The service layer imports contracts and db only.',
        ),
      ],
    },
  },
  {
    files: ['packages/api-client/src/**', 'packages/hooks/src/**', 'packages/ui/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: withSubpaths(workspace(['db', 'core', 'worker'])),
              message: 'Client code never imports the server: it calls the API.',
            },
            {
              group: withSubpaths(serverOnly),
              message: 'Client code never imports server libraries.',
            },
            {
              group: ['node:*'],
              message: 'Client code runs in the browser and on phones: no Node.js modules.',
            },
          ],
        },
      ],
    },
  },
  {
    // Screens. Only Route Handlers (app/api) and src/server may touch the server packages.
    files: ['apps/web/app/**', 'apps/web/src/**'],
    ignores: ['apps/web/app/api/**', 'apps/web/src/server/**', 'apps/web/proxy.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: withSubpaths(workspace(['db', 'core', 'worker'])),
              message: 'A screen never imports the server: it uses hooks, which call the API.',
            },
            {
              group: withSubpaths(serverOnly),
              message: 'A screen never imports server libraries.',
            },
            {
              group: ['@/server/*'],
              message: 'src/server is for Route Handlers and the proxy only.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/db/**', 'tests/**', '**/*.test.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['packages/db/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        forbid(
          [...workspace(['core', 'api-client', 'hooks', 'ui', 'worker']), ...browserOnly],
          'The database layer imports contracts only.',
        ),
      ],
    },
  },

  // -------------------------------------------------------------------------------- project rules

  {
    files: [
      'packages/core/src/**',
      'apps/web/app/api/**',
      'apps/web/src/server/**',
      'packages/worker/src/**',
    ],
    ignores: [
      '**/*.test.ts',
      'packages/core/src/kernel/dates.ts',
      'packages/core/src/kernel/cron.ts',
    ],
    rules: { 'no-restricted-syntax': ['error', ...noClock] },
  },
  {
    files: ['packages/core/src/modules/**', 'apps/web/app/api/**'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', ...noClock, ...noMoneyMaths] },
  },
  {
    files: ['apps/web/**/*.tsx', 'packages/ui/src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, '@next/next': nextPlugin },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      'no-restricted-syntax': ['error', ...themeRules],
      // The app directory is not at the repository root.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    files: ['packages/hooks/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
  },

  // ------------------------------------------------------------------------------------ exceptions

  {
    // Command-line scripts talk to the person running them.
    files: [
      'packages/db/src/scripts/**',
      'apps/web/scripts/**',
      'packages/db/src/seed/**',
      'tests/helpers/run-on-postgres.ts',
      'tests/smoke/**',
      '**/*.config.{ts,mjs,js}',
      'docs/**',
    ],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['tests/**', '**/*.test.ts'],
    rules: {
      // A test states what it expects; `value!` after an assertion reads better than a guard.
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
