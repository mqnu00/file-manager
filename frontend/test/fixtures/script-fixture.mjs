export default async function scriptFn(ctx) {
  const r = globalThis.__scriptFixtureResult
  if (r && r.throw) throw new Error('boom')
  return r === undefined ? undefined : r.value
}
