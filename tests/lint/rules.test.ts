import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/*
 * Each lint rule of the repository is proven here with a deliberately wrong file.
 * The file does not exist on disk: its text is given to ESLint together with the path it would
 * have, because the rules are decided by where a file lives.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let eslint: ESLint;

beforeAll(async () => {
  eslint = new ESLint({ cwd: root });
  // The first file ESLint sees makes it read the whole project's types, which takes far longer than
  // any later file. Doing that here keeps it out of the first test's time limit.
  await eslint.lintText('export const warmUp = 1;', {
    filePath: resolve(root, 'packages/contracts/src/modules/x/warm-up.contract.ts'),
  });
}, 300_000);

/** The messages ESLint gives for this text if it were saved at this path. */
async function lint(path: string, text: string): Promise<string[]> {
  const [result] = await eslint.lintText(text, { filePath: resolve(root, path) });
  return (result?.messages ?? []).map((message) => `${message.ruleId}: ${message.message}`);
}

const refused = async (path: string, text: string, pattern: RegExp) => {
  const messages = await lint(path, text);
  expect(messages.join('\n'), `${path} should be refused`).toMatch(pattern);
};
const allowed = async (path: string, text: string) => {
  expect(await lint(path, text), `${path} should pass`).toEqual([]);
};

describe('layer boundaries', () => {
  it('contracts import nothing but zod', async () => {
    await allowed(
      'packages/contracts/src/modules/x/x.contract.ts',
      "import { z } from 'zod';\nexport const X = z.object({ id: z.uuid() });\n",
    );
    await refused(
      'packages/contracts/src/modules/x/x.contract.ts',
      "import { rooms } from '@takhti/db';\nexport const a = rooms;\n",
      /bottom layer/,
    );
    await refused(
      'packages/contracts/src/modules/x/x.contract.ts',
      "import { sql } from 'drizzle-orm';\nexport const a = sql;\n",
      /only zod is allowed/,
    );
    await refused(
      'packages/contracts/src/modules/x/x.contract.ts',
      "import { randomUUID } from 'node:crypto';\nexport const a = randomUUID;\n",
      /no Node\.js modules/,
    );
    await refused(
      'packages/contracts/src/modules/x/x.contract.ts',
      "import { useState } from 'react';\nexport const a = useState;\n",
      /only zod is allowed/,
    );
  });

  it('the database layer imports contracts only', async () => {
    await allowed(
      'packages/db/src/schema/x/x.table.ts',
      "import { roomKinds } from '@takhti/contracts';\nexport const a = roomKinds;\n",
    );
    await refused(
      'packages/db/src/schema/x/x.table.ts',
      "import { rule } from '@takhti/core';\nexport const a = rule;\n",
      /imports contracts only/,
    );
    await refused(
      'packages/db/src/schema/x/x.table.ts',
      "import { api } from '@takhti/api-client';\nexport const a = api;\n",
      /imports contracts only/,
    );
  });

  it('the service layer imports contracts and db, never the client side', async () => {
    await allowed(
      'packages/core/src/modules/x/x.service.ts',
      "import { roomsContract } from '@takhti/contracts';\nimport { rooms } from '@takhti/db';\nexport const a = [roomsContract, rooms];\n",
    );
    await refused(
      'packages/core/src/modules/x/x.service.ts',
      "import { api } from '@takhti/api-client';\nexport const a = api;\n",
      /contracts and db only/,
    );
    await refused(
      'packages/core/src/modules/x/x.service.ts',
      "import { useRooms } from '@takhti/hooks';\nexport const a = useRooms;\n",
      /contracts and db only/,
    );
    await refused(
      'packages/core/src/modules/x/x.service.ts',
      "import { useState } from 'react';\nexport const a = useState;\n",
      /contracts and db only/,
    );
  });

  it('client code never imports the server', async () => {
    for (const path of [
      'packages/api-client/src/modules/x/x.api-service.ts',
      'packages/hooks/src/modules/x/x.hooks.ts',
      'packages/ui/src/data-table.tsx',
    ]) {
      await refused(
        path,
        "import { rule } from '@takhti/core';\nexport const a = rule;\n",
        /never imports the server/,
      );
      await refused(
        path,
        "import { rooms } from '@takhti/db';\nexport const a = rooms;\n",
        /never imports the server/,
      );
      await refused(
        path,
        "import postgres from 'postgres';\nexport const a = postgres;\n",
        /server libraries/,
      );
      await refused(
        path,
        "import { readFileSync } from 'node:fs';\nexport const a = readFileSync;\n",
        /no Node\.js modules/,
      );
    }
    await allowed(
      'packages/hooks/src/modules/x/x.hooks.ts',
      "import { roomsApi } from '@takhti/api-client';\nimport { roomsContract } from '@takhti/contracts';\nexport const a = [roomsApi, roomsContract];\n",
    );
  });

  it('a screen never imports the server; a Route Handler may', async () => {
    const text = "import { roomsService } from '@takhti/core';\nexport const a = roomsService;\n";
    await refused(
      'apps/web/app/(app)/school/rooms/page.tsx',
      text,
      /A screen never imports the server/,
    );
    await refused(
      'apps/web/src/features/rooms/rooms-table.tsx',
      text,
      /A screen never imports the server/,
    );
    await refused(
      'apps/web/src/features/rooms/rooms-table.tsx',
      "import { authenticate } from '@/server/auth';\nexport const a = authenticate;\n",
      /src\/server is for Route Handlers/,
    );
    await allowed('apps/web/app/api/v1/rooms/route.ts', text);
    await allowed('apps/web/src/server/extra.ts', text);
  });

  it('only the listed kernel files may use the privileged connection', async () => {
    const text = "import { adminDb } from '@takhti/db';\nexport const a = adminDb;\n";
    await refused(
      'packages/core/src/modules/fees/fee-vouchers.service.ts',
      text,
      /skips row-level security/,
    );
    await refused(
      'packages/core/src/kernel/settings.ts',
      "import { withAdminTx } from '@takhti/db';\nexport const a = withAdminTx;\n",
      /skips row-level security/,
    );
    await refused('apps/web/app/api/v1/rooms/route.ts', text, /skips row-level security/);
    await refused('packages/worker/src/extra.ts', text, /skips row-level security/);
    await allowed('packages/core/src/kernel/permissions.ts', text);
    await allowed('packages/core/src/modules/platform/orgs.service.ts', text);
    await allowed('packages/db/src/seed/run.ts', text);
  });
});

describe('project rules', () => {
  it('the clock is read in one place', async () => {
    const text = 'export const now = new Date();\n';
    await refused(
      'packages/core/src/modules/fees/fees.rules.ts',
      text,
      /Do not create Date objects here/,
    );
    await refused('apps/web/app/api/v1/rooms/route.ts', text, /Do not create Date objects here/);
    await refused('packages/core/src/kernel/settings.ts', text, /Do not create Date objects here/);
    await allowed('packages/core/src/kernel/dates.ts', text);
    await allowed('packages/core/src/modules/fees/fees.rules.test.ts', text);
  });

  it('money is never multiplied or divided directly in a module', async () => {
    await refused(
      'packages/core/src/modules/fees/fees.rules.ts',
      'export const fine = (amount: number) => amount * 0.05;\n',
      /Do not multiply or divide money directly/,
    );
    await refused(
      'packages/core/src/modules/fees/fees.rules.ts',
      'export const half = (voucher: { balance: number }) => voucher.balance / 2;\n',
      /Do not multiply or divide money directly/,
    );
    await allowed(
      'packages/core/src/modules/fees/fees.rules.ts',
      'export const pages = (rows: number, perPage: number) => rows / perPage;\n',
    );
    await allowed(
      'packages/core/src/modules/fees/fees.rules.ts',
      'export const sum = (amount: number, fine: number) => amount + fine;\n',
    );
  });

  it('no console output, no any, no non-null assertion in product code', async () => {
    await refused(
      'packages/core/src/modules/x/x.service.ts',
      "console.log('here');\n",
      /no-console/,
    );
    await refused(
      'packages/core/src/modules/x/x.service.ts',
      'export const a = (value: any) => value;\n',
      /no-explicit-any/,
    );
    await refused(
      'packages/core/src/modules/x/x.service.ts',
      'export const a = (value?: string) => value!.length;\n',
      /no-non-null-assertion/,
    );
    await allowed(
      'packages/db/src/scripts/extra.ts',
      "console.log('a script may talk to the person running it');\n",
    );
  });

  it('the theme: logical directions only, so the layout mirrors for Urdu', async () => {
    const page = (className: string) =>
      `export default function Page() {\n  return <div className="${className}">x</div>;\n}\n`;
    for (const wrong of [
      'ml-4',
      'flex pr-2',
      'left-0 absolute',
      'text-left',
      'border-l-2',
      '-mr-1',
    ]) {
      await refused('apps/web/app/(app)/school/page.tsx', page(wrong), /Use logical classes/);
    }
    await allowed(
      'apps/web/app/(app)/school/page.tsx',
      page('ms-4 pe-2 start-0 text-start border-s-2 flex items-center'),
    );
  });

  it('the theme: square corners everywhere', async () => {
    const page = (className: string) =>
      `export default function Page() {\n  return <div className="${className}">x</div>;\n}\n`;
    for (const wrong of ['rounded', 'rounded-md border', 'p-2 rounded-full', 'rounded-t-lg']) {
      await refused('packages/ui/src/button.tsx', page(wrong), /square corners/);
    }
    await allowed('packages/ui/src/button.tsx', page('rounded-none border p-2'));
    await allowed('packages/ui/src/button.tsx', page('border p-2 surrounded-by-nothing'));
  });
});
