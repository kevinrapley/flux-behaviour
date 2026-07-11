import worker from '../../src/cloudflare/worker.mjs';

export async function onRequest(context) {
  return worker.fetch(context.request, context.env, context);
}
