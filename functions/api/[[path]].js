function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export async function onRequest(context) {
  const backendOrigin = String(context.env.BACKEND_ORIGIN || '').trim();

  if (!backendOrigin) {
    return jsonResponse(503, {
      error: 'BACKEND_ORIGIN is not configured for the Cloudflare Pages project.'
    });
  }

  let backendUrl;
  try {
    backendUrl = new URL(backendOrigin);
  } catch {
    return jsonResponse(500, {
      error: 'BACKEND_ORIGIN must be a valid URL, for example https://example.onrender.com.'
    });
  }

  if (backendUrl.protocol !== 'https:') {
    return jsonResponse(500, {
      error: 'BACKEND_ORIGIN must use HTTPS.'
    });
  }

  const incomingUrl = new URL(context.request.url);
  const matchedPath = Array.isArray(context.params.path)
    ? context.params.path.join('/')
    : String(context.params.path || '');

  backendUrl.pathname = `/api/${matchedPath}`;
  backendUrl.search = incomingUrl.search;

  const headers = new Headers(context.request.headers);
  headers.delete('host');
  headers.set('x-forwarded-proto', 'https');
  headers.set('x-forwarded-host', incomingUrl.host);

  const clientIp = context.request.headers.get('cf-connecting-ip');
  if (clientIp) {
    headers.set('x-forwarded-for', clientIp);
    headers.set('x-real-ip', clientIp);
  } else {
    headers.delete('x-forwarded-for');
    headers.delete('x-real-ip');
  }

  const method = context.request.method.toUpperCase();
  const upstreamRequest = new Request(backendUrl.toString(), {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : context.request.body,
    redirect: 'manual'
  });

  try {
    const upstreamResponse = await fetch(upstreamRequest);
    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set('Cache-Control', 'no-store');
    responseHeaders.set('X-RoyalWrap-API-Proxy', 'cloudflare-pages');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    return jsonResponse(502, {
      error: 'RoyalWrap backend is currently unavailable.',
      detail: error instanceof Error ? error.message : 'Upstream request failed.'
    });
  }
}
