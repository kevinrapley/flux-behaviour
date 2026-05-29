import { loadEventSchema, validateEvent } from '../events/index.mjs';
import {
  invalidJsonResponse,
  jsonResponse,
  methodNotAllowedResponse,
  notFoundResponse,
  validationFailedResponse
} from './responses.mjs';

const eventSchema = loadEventSchema();

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

  const validation = validateEvent(event, eventSchema);

  if (!validation.valid) {
    return validationFailedResponse(validation.errors);
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
