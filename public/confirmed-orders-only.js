(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const response = await nativeFetch(input, init);

    try {
      const requestUrl = typeof input === 'string' ? input : input.url;
      const pathname = new URL(requestUrl, window.location.href).pathname;
      const method = String(init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();

      if (method !== 'POST' || pathname !== '/api/customer/orders' || !response.ok) {
        return response;
      }

      const requestData = init.body ? JSON.parse(init.body) : {};
      if (requestData.mode !== 'list') return response;

      const data = await response.clone().json();
      const orders = Array.isArray(data.orders) ? data.orders : [];

      data.orders = orders.filter((order) => {
        const paymentStatus = String(order.paymentStatus || '').trim().toLowerCase();
        return paymentStatus === 'captured' || paymentStatus === 'paid';
      });

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
