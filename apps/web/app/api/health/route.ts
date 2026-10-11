/** `GET /api/health`: the process is up. It checks nothing else, so a load balancer can call it often. */
export function GET(): Response {
  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
