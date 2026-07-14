(() => {
  'use strict';

  const STORAGE_KEY = 'royalwrap-order-images';
  const CART_KEY = 'royalwraps-cart';
  const originalFetch = window.fetch.bind(window);

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function safeImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(?:\.\/)?assets\//i.test(raw) || /^\/assets\//i.test(raw)) return raw.replace(/^\.\//, '');
    try {
      const url = new URL(raw, window.location.origin);
      if (url.protocol === 'https:' && url.hostname === 'res.cloudinary.com') return url.href;
    } catch {}
    return '';
  }

  function rememberOrderImages(orderId, responseItems = []) {
    if (!orderId) return;
    const cart = readJson(CART_KEY, []);
    if (!Array.isArray(cart)) return;

    const storedItems = (Array.isArray(responseItems) ? responseItems : []).map((item, index) => {
      const cartItem = cart.find((entry) =>
        normalize(entry?.id) === normalize(item?.id)
        && normalize(entry?.brand) === normalize(item?.brand)
        && normalize(entry?.model) === normalize(item?.model)
      ) || cart[index] || {};

      return {
        id: String(item?.id || cartItem.id || '').trim(),
        name: String(item?.name || '').trim(),
        brand: String(item?.brand || cartItem.brand || '').trim(),
        model: String(item?.model || cartItem.model || '').trim(),
        qty: Math.max(1, Number.parseInt(item?.qty ?? cartItem.qty, 10) || 1),
        imageUrl: safeImageUrl(cartItem.image)
      };
    });

    const all = readJson(STORAGE_KEY, {});
    const next = all && typeof all === 'object' && !Array.isArray(all) ? all : {};
    next[orderId] = storedItems;

    const recentIds = Object.keys(next).slice(-30);
    const compact = {};
    recentIds.forEach((id) => { compact[id] = next[id]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
  }

  window.fetch = async (input, init = {}) => {
    const response = await originalFetch(input, init);

    try {
      const requestUrl = typeof input === 'string' ? input : input.url;
      const pathname = new URL(requestUrl, window.location.href).pathname;
      const method = String(init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();

      if (method === 'POST' && pathname === '/api/create-order' && response.ok) {
        const data = await response.clone().json();
        rememberOrderImages(data.orderId, data.items);
      }
    } catch {}

    return response;
  };
})();
