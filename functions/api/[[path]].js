import { handleApiRequest } from '../../_lib/royalwrap-backend.js';

export function onRequest(context) {
  const matchedPath = Array.isArray(context.params.path)
    ? context.params.path.join('/')
    : String(context.params.path || '');

  return handleApiRequest(context.request, context.env, matchedPath);
}
