import { handleCollectorRequest } from '../collector/router.mjs';

export default {
  async fetch(request, env, ctx) {
    return handleCollectorRequest(request);
  }
};
