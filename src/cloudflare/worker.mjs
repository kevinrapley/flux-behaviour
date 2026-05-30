import { applyCollectorBoundary, createBoundaryPolicyFromEnv } from '../collector/boundary-controls.mjs';
import { handleCollectorRequest } from '../collector/router.mjs';

export default {
  async fetch(request, env, ctx) {
    const policy = createBoundaryPolicyFromEnv(env);
    return applyCollectorBoundary(request, policy, handleCollectorRequest);
  }
};
