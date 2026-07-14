(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);

  function showModelOnly(value) {
    return String(value || '').replace(/\(([^()]+)\)(\s*x\s*\d+)?/gi, (full, selection, quantity = '') => {
      const parts = String(selection).trim().split(/\s+/).filter(Boolean);
      if (parts.length < 2) return full;
      return `(${parts.slice(1).join(' ')})${quantity}`;
    });
  }

  window.fetch = async (input, init = {}) => {
    const response = await nativeFetch(input, init);

    try {
      const requestUrl = typeof input === 'string' ? input : input.url;
      const pathname = new URL(requestUrl, window.location.href).pathname;
      const method = String(init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();

      if (method !== 'POST' || pathname !== '/api/customer/orders' || !response.ok) {
        return response;
      }

      const data = await response.clone().json();
      if (!Array.isArray(data.orders)) return response;

      data.orders = data.orders.map((order) => ({
        ...order,
        items: showModelOnly(order.items)
      }));

      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');

      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch {
      return response;
    }
  };
})();
