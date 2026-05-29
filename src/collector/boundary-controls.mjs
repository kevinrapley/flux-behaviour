const DEFAULT_ALLOWED_HEADERS = ['content-type'];
const DEFAULT_ALLOWED_METHODS = ['POST', 'OPTIONS'];
const DEFAULT_MAX_BODY_BYTES = 32768;

export function createBoundaryPolicy(options = {}) {
  return {
    allowedOrigins: normaliseList(options.allowedOrigins),
    allowedHeaders: normaliseList(options.allowedHeaders ?? DEFAULT_ALLOWED_HEADERS),
    allowedMethods: normaliseList(options.allowedMethods ?? DEFAULT_ALLOWED_METHODS),
    maxBodyBytes: Number.isInteger(options.maxBodyBytes) && options.maxBodyBytes > 0
      ? options.maxBodyBytes
      : DEFAULT_MAX_BODY_BYTES,
    rateLimiter: options.rateLimiter ?? createAllowAllRateLimiter()
  };
}

export function createBoundaryPolicyFromEnv(env = {}) {
  return createBoundaryPolicy({
    allowedOrigins: splitConfigList(env.FLUX_ALLOWED_ORIGINS),
    allowedHeaders: splitConfigList(env.FLUX_ALLOWED_HEADERS) ?? DEFAULT_ALLOWED_HEADERS,
    allowedMethods: splitConfigList(env.FLUX_ALLOWED_METHODS) ?? DEFAULT_ALLOWED_METHODS,
    maxBodyBytes: parsePositiveInteger(env.FLUX_MAX_BODY_BYTES) ?? DEFAULT_MAX_BODY_BYTES
  });
}

export function createAllowAllRateLimiter() {
  return {
    async check() {
      return { allowed: true };
    }
  };
}

export async function applyCollectorBoundary(request, policy, next) {
  const url = new URL(request.url);

  if (url.pathname !== '/collect') {
    return next(request);
  }

  if (request.method === 'OPTIONS') {
    return handlePreflight(request, policy);
  }

  if (request.method !== 'POST') {
    return boundaryJsonResponse('method_not_allowed', 'Method is not allowed for this route.', 405, {
      allow: 'POST, OPTIONS'
    });
  }

  const originDecision = checkOrigin(request, policy);
  if (!originDecision.allowed) {
    return boundaryJsonResponse('origin_not_allowed', 'Origin is not allowed for this route.', 403);
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return withCors(boundaryJsonResponse('unsupported_media_type', 'Request content type must be application/json.', 415), request, policy);
  }

  const contentLengthDecision = checkContentLength(request, policy);
  if (!contentLengthDecision.allowed) {
    return withCors(boundaryJsonResponse('request_too_large', 'Request body is larger than allowed.', 413), request, policy);
  }

  const rateLimitDecision = await policy.rateLimiter.check(request);
  if (!rateLimitDecision.allowed) {
    return withCors(boundaryJsonResponse('rate_limited', 'Request rate limit exceeded.', 429), request, policy);
  }

  return withCors(await next(request), request, policy);
}

function handlePreflight(request, policy) {
  const originDecision = checkOrigin(request, policy);
  if (!originDecision.allowed) {
    return boundaryJsonResponse('origin_not_allowed', 'Origin is not allowed for this route.', 403);
  }

  const requestedMethod = request.headers.get('access-control-request-method');
  if (requestedMethod !== 'POST') {
    return withCors(boundaryJsonResponse('method_not_allowed', 'Requested method is not allowed for this route.', 405), request, policy);
  }

  const requestedHeaders = parseRequestedHeaders(request.headers.get('access-control-request-headers'));
  const disallowedHeader = requestedHeaders.find((header) => !policy.allowedHeaders.includes(header));
  if (disallowedHeader) {
    return withCors(boundaryJsonResponse('header_not_allowed', 'Requested header is not allowed for this route.', 400), request, policy);
  }

  return withCors(new Response(null, {
    status: 204,
    headers: {
      'cache-control': 'no-store',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': policy.allowedHeaders.join(', '),
      'access-control-max-age': '600'
    }
  }), request, policy);
}

function checkOrigin(request, policy) {
  const origin = request.headers.get('origin');
  if (!origin) return { allowed: true };

  return {
    allowed: policy.allowedOrigins.includes(origin)
  };
}

function checkContentLength(request, policy) {
  const rawLength = request.headers.get('content-length');
  if (!rawLength) return { allowed: true };

  const contentLength = Number.parseInt(rawLength, 10);
  if (!Number.isFinite(contentLength)) return { allowed: false };

  return {
    allowed: contentLength <= policy.maxBodyBytes
  };
}

function withCors(response, request, policy) {
  const origin = request.headers.get('origin');
  if (!origin || !policy.allowedOrigins.includes(origin)) return response;

  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('vary', appendVaryOrigin(headers.get('vary')));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function boundaryJsonResponse(code, message, status, headers = {}) {
  return new Response(JSON.stringify({
    ok: false,
    error: {
      code,
      message
    }
  }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

function normaliseList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function splitConfigList(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parsePositiveInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseRequestedHeaders(value) {
  if (!value) return [];
  return value.split(',').map((header) => header.trim().toLowerCase()).filter(Boolean);
}

function appendVaryOrigin(value) {
  if (!value) return 'Origin';
  const parts = value.split(',').map((part) => part.trim().toLowerCase());
  if (parts.includes('origin')) return value;
  return `${value}, Origin`;
}
