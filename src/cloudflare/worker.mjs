import { applyCollectorBoundary, createBoundaryPolicyFromEnv } from '../collector/boundary-controls.mjs';
import { handleCollectorRequest } from '../collector/router.mjs';
import { handleProductRequest } from '../product/router.mjs';

export default {
  async fetch(request, env, ctx) {
    const productResponse = await handleProductRequest(request, env);
    if (productResponse) return productResponse;
    const policy = createBoundaryPolicyFromEnv(env);
    return applyCollectorBoundary(request, policy, handleCollectorRequest);
  }
};
