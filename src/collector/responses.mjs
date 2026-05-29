export function jsonResponse(body, init = {}) {
  const status = init.status ?? 200;
  const headers = new Headers(init.headers ?? {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');

  return new Response(JSON.stringify(body), {
    status,
    headers
  });
}

export function methodNotAllowedResponse(allowedMethods) {
  return jsonResponse({
    ok: false,
    error: {
      code: 'method_not_allowed',
      message: 'Method is not allowed for this route.'
    }
  }, {
    status: 405,
    headers: {
      allow: allowedMethods.join(', ')
    }
  });
}

export function notFoundResponse() {
  return jsonResponse({
    ok: false,
    error: {
      code: 'not_found',
      message: 'Route was not found.'
    }
  }, {
    status: 404
  });
}

export function invalidJsonResponse() {
  return jsonResponse({
    ok: false,
    error: {
      code: 'invalid_json',
      message: 'Request body must be valid JSON.'
    }
  }, {
    status: 400
  });
}

export function validationFailedResponse(errors) {
  return jsonResponse({
    ok: false,
    error: {
      code: 'validation_failed',
      message: 'Event failed validation.',
      details: errors
    }
  }, {
    status: 400
  });
}
