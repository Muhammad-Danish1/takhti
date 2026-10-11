import { pingDatabase } from '@takhti/db';

/** `GET /api/ready`: 200 only when the database answers, so traffic is not sent to an instance that cannot serve it. */
export async function GET(): Promise<Response> {
  const db = await pingDatabase();
  return Response.json(
    { ok: db, db },
    { status: db ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
