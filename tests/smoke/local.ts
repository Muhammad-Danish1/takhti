/*
 * A live check of the running app against the local stack, with real sign-ins:
 *
 *   pnpm db:start && pnpm db:reset      (once)
 *   pnpm dev                            (in another terminal)
 *   pnpm smoke
 *
 * It signs in as seeded accounts through Supabase Auth, calls the API with the tokens it gets, and
 * says plainly what passed and what did not. It changes almost nothing: the one room it creates,
 * it deletes again.
 */
import { SEED_PASSWORD } from '../../packages/db/src/seed/accounts';

const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !publishableKey) {
  console.error(
    'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set. Run `pnpm db:env`.',
  );
  process.exit(1);
}

let failures = 0;
function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(
    `  ${passed ? 'ok  ' : 'FAIL'}  ${label}${passed || !detail ? '' : `\n          ${detail}`}`,
  );
}

async function signIn(email: string): Promise<{ token: string; claims: Record<string, unknown> }> {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey as string, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: SEED_PASSWORD }),
  });
  const body = (await response.json()) as {
    access_token?: string;
    msg?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(
      `Could not sign in as ${email}: ${body.msg ?? body.error_description ?? response.status}. Was \`pnpm db:reset\` run?`,
    );
  }
  const payload = body.access_token.split('.')[1] ?? '';
  return {
    token: body.access_token,
    claims: JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >,
  };
}

interface Answer {
  status: number;
  data: unknown;
  error: { code: string; message: string } | undefined;
}

async function call(
  token: string | undefined,
  method: string,
  path: string,
  body?: unknown,
): Promise<Answer> {
  const response = await fetch(`${appUrl}${path}`, {
    method,
    headers: {
      ...(token && { authorization: `Bearer ${token}` }),
      ...(body !== undefined && { 'content-type': 'application/json' }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as { data?: unknown; error?: Answer['error'] }) : {};
  return { status: response.status, data: parsed.data, error: parsed.error };
}

console.log(`\nSmoke test against ${appUrl}\n`);

try {
  const health = await fetch(`${appUrl}/api/health`)
    .then((response) => response.status)
    .catch(() => 0);
  if (health !== 200) {
    console.error(`The app is not answering at ${appUrl}. Start it with \`pnpm dev\`.`);
    process.exit(1);
  }
  check('GET /api/health answers 200', true);
  check(
    'GET /api/ready says the database answers',
    (await fetch(`${appUrl}/api/ready`)).status === 200,
  );
  check(
    'without a session the API answers 401',
    (await call(undefined, 'GET', '/api/v1/me')).status === 401,
  );

  const principal = await signIn('principal@roshan.test');
  check('a seeded account can sign in through Supabase Auth', true);
  check(
    'the token hook added the school to the token',
    typeof principal.claims.org_id === 'string' && principal.claims.kind === 'staff',
    JSON.stringify(Object.keys(principal.claims)),
  );

  const me = await call(principal.token, 'GET', '/api/v1/me');
  const meData = me.data as
    | {
        org?: { slug?: string };
        branches?: { code: string }[];
        permissions?: string[];
        membership?: { roleKeys?: string[] };
      }
    | undefined;
  check(
    'GET /api/v1/me describes the principal of Roshan',
    me.status === 200 &&
      meData?.org?.slug === 'roshan' &&
      meData.membership?.roleKeys?.[0] === 'principal',
    JSON.stringify(me.error ?? me.data).slice(0, 300),
  );
  check(
    'the principal works at Main Campus only',
    JSON.stringify(meData?.branches?.map((branch) => branch.code)) === '["MC"]',
  );

  const branches = await call(principal.token, 'GET', '/api/v1/branches?sort=code');
  const codes = ((branches.data as { items?: { code: string }[] } | undefined)?.items ?? []).map(
    (branch) => branch.code,
  );
  check(
    'GET /api/v1/branches lists the seeded branches',
    branches.status === 200 && codes.join(',') === 'CC,MC',
    `${branches.status} ${codes.join(',')}`,
  );

  const rooms = await call(principal.token, 'GET', '/api/v1/rooms?pageSize=100');
  const roomCount = (rooms.data as { total?: number } | undefined)?.total;
  check(
    'the principal sees the 24 rooms of Main Campus and none of City Campus',
    rooms.status === 200 && roomCount === 24,
    `${rooms.status} total=${roomCount}`,
  );

  const mainCampus = meData?.branches?.[0] as { id?: string } | undefined;
  const created = await call(principal.token, 'POST', '/api/v1/rooms', {
    branchId: mainCampus?.id,
    name: `Smoke Test Room ${Date.now()}`,
    kind: 'other',
  });
  const roomId = (created.data as { id?: string } | undefined)?.id;
  check(
    'POST /api/v1/rooms creates a room',
    created.status === 201 && Boolean(roomId),
    JSON.stringify(created.error),
  );
  if (roomId)
    check(
      'DELETE /api/v1/rooms/[id] removes it again',
      (await call(principal.token, 'DELETE', `/api/v1/rooms/${roomId}`)).status === 204,
    );

  const driver = await signIn('driver@roshan.test');
  check(
    'a driver may look at branches but not add one (403)',
    (await call(driver.token, 'GET', '/api/v1/branches')).status === 200 &&
      (
        await call(driver.token, 'POST', '/api/v1/branches', {
          code: 'XX',
          name: 'Not Allowed',
          address: '1 Road',
          city: 'Lahore',
        })
      ).status === 403,
  );

  const guardian = await signIn('guardian@roshan.test');
  check(
    'a guardian is refused the staff routes (403)',
    (await call(guardian.token, 'GET', '/api/v1/branches')).status === 403,
  );
  check(
    'a guardian still gets their own /me',
    (await call(guardian.token, 'GET', '/api/v1/me')).status === 200,
  );

  const otherSchool = await signIn('owner@alnoor.test');
  const theirs = await call(otherSchool.token, 'GET', '/api/v1/branches');
  const theirCodes = ((theirs.data as { items?: { code: string }[] } | undefined)?.items ?? []).map(
    (branch) => branch.code,
  );
  check(
    'another school sees only its own branch',
    theirs.status === 200 && theirCodes.join(',') === 'AN',
    theirCodes.join(','),
  );
  if (roomId)
    check(
      'and cannot reach a record of this school by its id (404)',
      (await call(otherSchool.token, 'GET', `/api/v1/rooms/${roomId}`)).status === 404,
    );

  check(
    'a forged token is refused (401)',
    (await call(`${principal.token.slice(0, -6)}abcdef`, 'GET', '/api/v1/me')).status === 401,
  );

  // The people behind the sign-ins (Phase 1, Wave 1).
  check(
    'the guardian’s token names his three children and his family',
    Array.isArray(guardian.claims.student_ids) &&
      guardian.claims.student_ids.length === 3 &&
      typeof guardian.claims.family_id === 'string' &&
      typeof guardian.claims.guardian_id === 'string',
    JSON.stringify(guardian.claims.student_ids),
  );
  const student = await signIn('student@roshan.test');
  check(
    'a student’s token names only themself',
    Array.isArray(student.claims.student_ids) &&
      student.claims.student_ids.length === 1 &&
      student.claims.kind === 'student',
    JSON.stringify(student.claims.student_ids),
  );
  const teacherParent = await signIn('teacher.parent@roshan.test');
  const choices = await call(teacherParent.token, 'GET', '/api/v1/me/memberships');
  const kinds = ((choices.data as { kind?: string }[] | undefined) ?? [])
    .map((choice) => choice.kind)
    .sort();
  check(
    'a teacher who is also a parent is asked where to continue: no school in the token, two memberships to choose from',
    teacherParent.claims.org_id === undefined &&
      choices.status === 200 &&
      kinds.join(',') === 'guardian,staff',
    `${choices.status} ${kinds.join(',')}`,
  );
} catch (error) {
  failures += 1;
  console.error(`\n  ${error instanceof Error ? error.message : String(error)}`);
}

console.log(
  failures === 0 ? '\nEverything answered as it should.\n' : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
