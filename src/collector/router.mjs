import { fluxEventSchema } from '../events/flux-event-schema.mjs';
import { validateEventRuntime } from '../events/validate-event-runtime.mjs';
import {
  invalidJsonResponse,
  jsonResponse,
  methodNotAllowedResponse,
  notFoundResponse,
  validationFailedResponse
} from './responses.mjs';

const MAX_DETAILS = 10;
const MAX_EVENT_PROPERTIES = Object.keys(fluxEventSchema.properties).length;

export async function handleCollectorRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return handleHealth(request);
  }

  if (url.pathname === '/collect') {
    return handleCollect(request);
  }

  return notFoundResponse();
}

function handleHealth(request) {
  if (request.method !== 'GET') {
    return methodNotAllowedResponse(['GET']);
  }

  return jsonResponse({
    ok: true,
    service: 'flux-behaviour-collector',
    status: 'scaffold',
    storage: 'disabled'
  });
}

async function handleCollect(request) {
  if (request.method !== 'POST') {
    return methodNotAllowedResponse(['POST']);
  }

  let event;

  try {
    event = await request.json();
  } catch {
    return invalidJsonResponse();
  }

  if (hasTooManyProperties(event)) {
    return validationFailedResponse([{
      code: 'additional_property',
      field: null,
      message: 'An additional field is not allowed by the event contract.'
    }]);
  }

  const validation = validateEventRuntime(event, fluxEventSchema);

  if (!validation.valid) {
    const bounded = validation['errors'].slice(0, MAX_DETAILS);
    return validationFailedResponse(bounded);
  }

  return jsonResponse({
    ok: true,
    accepted: true,
    stored: false,
    storage: 'disabled'
  }, {
    status: 202
  });
}

function hasTooManyProperties(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return false;
  return Object.keys(event).length > MAX_EVENT_PROPERTIES;
}
