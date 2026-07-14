(() => {
  'use strict';

  const mode = document.body.dataset.orderMode;
  const accountMobile = document.getElementById('accountMobile');
  const logoutBtn = document.getElementById('logoutBtn');
  const refreshBtn = document.getElementById('refreshOrdersBtn');
  const messageEl = document.getElementById('orderMessage');
  const resultEl = document.getElementById('orderResults');
  const countEl = document.getElementById('orderCountText');
  const searchInput = document.getElementById('orderSearch');
  const filterSelect = document.getElementById('orderFilter');

  if (!accountMobile || !logoutBtn || !messageEl || !resultEl || !['list', 'track'].includes(mode)) return;

  const displayStages = ['Order Confirmed', 'Shipped', 'Delivered'];
  const ORDER_IMAGE_STORAGE_KEY = 'royalwrap-order-images';
  const productImagesByName = {
    'Sapphire Marble Gold Skin': 'assets/products/sapphire-marble.png',
    'Royal Midnight Palace Skin': 'assets/products/royal-midnight.png',
    'Obsidian Diamond Armor Skin': 'assets/products/obsidian-diamond.png',
    'Peacock Jewel Krishna Skin': 'assets/products/peacock-krishna.png',
    'Bhagwan Ram Skin': 'assets/products/bhagwan-ram.jpeg',
    'Ayodhya Mandir Heritage Skin': 'assets/products/ayodhya-mandir.png',
    'Lotus Jaali Palace Skin': 'assets/products/lotus-jaali.png',
    'Cosmic Galaxy Vortex Skin': 'assets/products/cosmic-galaxy.png',
    'Honeycomb Copper Pro Skin': 'assets/products/honeycomb-pro.png',
    'Luxury Quilted Leather Skin': 'assets/products/luxury-leather.png',
    'Emerald Marble Gold Skin': 'assets/products/emerald-marble.png'
  };
  const productImagesById = {
    'sapphire-marble': 'assets/products/sapphire-marble.png',
    'royal-midnight': 'assets/products/royal-midnight.png',
    'obsidian-diamond': 'assets/products/obsidian-diamond.png',
    'peacock-krishna': 'assets/products/peacock-krishna.png',
    'bhagwan-ram': 'assets/products/bhagwan-ram.jpeg',
    'ayodhya-mandir': 'assets/products/ayodhya-mandir.png',
    'lotus-jaali': 'assets/products/lotus-jaali.png',
    'cosmic-galaxy': 'assets/products/cosmic-galaxy.png',
    'honeycomb-pro': 'assets/products/honeycomb-pro.png',
    'luxury-leather': 'assets/products/luxury-leather.png',
    'emerald-marble': 'assets/products/emerald-marble.png'
  };

  let loadedOrders = [];

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function setMessage(text, type = '') {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`.trim();
  }

  function loginUrl() {
    return `/login.html?return=${encodeURIComponent(location.pathname)}`;
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      location.replace(loginUrl());
      throw new Error('Login required.');
    }
    if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
    return data;
  }

  function formatDate(value) {
    if (!value) return 'Date unavailable';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).format(date);
  }

  function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(date);
  }

  function isPaid(order) {
    return ['captured', 'paid'].includes(normalize(order.paymentStatus));
  }

  function rawFulfillment(order) {
    const value = normalize(order.fulfillmentStatus || 'New');
    if (value === 'delivered') return 'Delivered';
    if (value === 'shipped') return 'Shipped';
    if (['cancelled', 'canceled'].includes(value)) return 'Cancelled';
    return 'Order Confirmed';
  }

  function paymentMethodLabel(value) {
    const labels = {
      upi: 'UPI', card: 'Card', netbanking: 'Netbanking', wallet: 'Wallet', emi: 'EMI', paylater: 'Pay Later'
    };
    return labels[normalize(value)] || (value ? String(value) : 'Not available');
  }

  function deliveryAddress(order) {
    return String(order.customer?.address || '').trim() || 'Delivery address is not available for this order.';
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

  function savedOrderImages(orderId) {
    try {
      const all = JSON.parse(localStorage.getItem(ORDER_IMAGE_STORAGE_KEY) || '{}');
      return Array.isArray(all?.[orderId]) ? all[orderId] : [];
    } catch {
      return [];
    }
  }

  function cleanSelection(value) {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length > 1 && normalize(parts[0]) === normalize(parts[1])) parts.shift();
    return parts.join(' ');
  }

  function parseItemsText(value) {
    const text = String(value || '').trim();
    if (!text) return [];
    const parsed = [];
    const pattern = /(.+?)\s+\(([^()]*)\)\s*x\s*(\d+)(?:,\s*|$)/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      parsed.push({
        name: match[1].trim(),
        model: cleanSelection(match[2]),
        qty: Math.max(1, Number.parseInt(match[3], 10) || 1)
      });
    }
    return parsed.length ? parsed : [{ name: text, model: '', qty: 1 }];
  }

  function orderItems(order) {
    const parsed = parseItemsText(order.items);
    const saved = savedOrderImages(order.id);
    return parsed.map((item, index) => {
      const stored = saved.find((entry) => normalize(entry?.name) === normalize(item.name)) || saved[index] || {};
      const id = String(stored.id || '').trim();
      const name = String(stored.name || item.name || 'RoyalWrap mobile skin').trim();
      const model = cleanSelection(stored.model || item.model);
      const qty = Math.max(1, Number.parseInt(stored.qty ?? item.qty, 10) || 1);
      const isCustom = id === 'custom-mobile-skin' || /custom\s+photo\s+mobile\s+skin/i.test(name);
      const imageUrl = safeImageUrl(stored.imageUrl || stored.image)
        || safeImageUrl(productImagesById[id])
        || safeImageUrl(productImagesByName[name]);
      return { id, name, model, qty, isCustom, imageUrl };
    });
  }

  function productTitle(item) {
    return `${item.name}${item.model ? ` (${item.model})` : ''} x ${item.qty}`;
  }

  function renderProgress(order) {
    if (!isPaid(order) || rawFulfillment(order) === 'Cancelled') return '';
    const current = rawFulfillment(order);
    const currentIndex = Math.max(0, displayStages.indexOf(current));
    const fill = (currentIndex / (displayStages.length - 1)) * (2 / 3) * 100;

    return `<div class="order-progress" aria-label="Order progress: ${esc(current)}">
      <span class="progress-fill" style="width:${fill}%"></span>
      ${displayStages.map((stage, index) => {
        const done = index <= currentIndex;
        return `<div class="progress-step ${done ? 'done' : ''}${index === currentIndex ? ' current' : ''}">
          <span class="progress-dot" aria-hidden="true">${done ? '✓' : ''}</span>
          <span>${esc(stage)}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function locationIcon() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>`;
  }

  function renderMyOrderAction(order) {
    if (rawFulfillment(order) === 'Delivered' || rawFulfillment(order) === 'Cancelled') return '';
    return '<div class="product-actions"><a class="action-button primary" href="track-order.html">Track package</a></div>';
  }

  function renderProductImage(item) {
    if (!item.imageUrl) {
      return '<div class="product-thumb product-thumb--missing" aria-label="Product image unavailable"><span>Photo</span></div>';
    }
    return `<div class="product-thumb ${item.isCustom ? 'product-thumb--custom' : ''}">
      <img src="${esc(item.imageUrl)}" alt="${esc(item.name)}" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add('product-thumb--missing')">
      <span>Photo</span>
    </div>`;
  }

  function renderProductRows(order, options = {}) {
    const items = orderItems(order);
    const action = options.action || '';
    const courier = options.courier || '';
    return `<div class="order-products">
      ${items.map((item, index) => `<div class="product-row ${(action && index === 0) ? '' : 'no-actions'}">
        ${renderProductImage(item)}
        <div class="product-info">
          <h4>${esc(productTitle(item))}</h4>
          ${courier && index === 0 ? `<p>Courier: ${esc(courier)}</p>` : ''}
          <div class="delivery-note">${locationIcon()}<span>${esc(deliveryAddress(order))}</span></div>
        </div>
        ${index === 0 ? action : ''}
      </div>`).join('')}
    </div>`;
  }

  function renderDetails(order) {
    const shipment = order.shipment || {};
    return `<details class="order-details">
      <summary>View complete order details</summary>
      <div class="details-grid">
        <div class="detail-box"><span>Full order ID</span><strong>${esc(order.id || 'Unavailable')}</strong></div>
        <div class="detail-box"><span>Payment method</span><strong>${esc(paymentMethodLabel(order.paymentMethod))}</strong></div>
        <div class="detail-box"><span>Delivery address</span><strong>${esc(deliveryAddress(order))}</strong></div>
        <div class="detail-box"><span>Courier</span><strong>${esc(shipment.courierName || 'Not assigned')}</strong></div>
        <div class="detail-box"><span>AWB number</span><strong>${esc(shipment.awbCode || 'Not assigned')}</strong></div>
        <div class="detail-box"><span>Last updated</span><strong>${esc(formatDateTime(shipment.updatedAt || order.statusUpdatedAt) || 'Not available')}</strong></div>
      </div>
    </details>`;
  }

  function renderSummaryOrder(order) {
    return `<article class="order-card">
      <div class="order-card__body">
        ${renderProductRows(order, { action: renderMyOrderAction(order) })}
        ${renderProgress(order)}
        ${renderDetails(order)}
      </div>
    </article>`;
  }

  function renderTrackingEvents(order) {
    const shipment = order.shipment || {};
    const live = order.liveTracking || {};
    const activities = Array.isArray(live.activities) ? live.activities : [];

    if (!shipment.awbCode) {
      return '<div class="no-tracking"><span class="no-tracking-icon" aria-hidden="true">i</span><div><strong>Tracking is not available yet</strong>Courier and AWB details will appear after your confirmed order is shipped.</div></div>';
    }

    const events = activities.length ? activities : [{
      status: live.currentStatus || shipment.shiprocketStatus || 'Shipment created',
      activity: 'Courier tracking has started.',
      location: '',
      date: shipment.updatedAt || ''
    }];

    return `<div class="tracking-panel">
      <div class="tracking-panel-head">
        <div><h4>${esc(live.currentStatus || shipment.shiprocketStatus || 'Live tracking')}</h4><p>${esc(shipment.courierName || 'Courier')} · AWB ${esc(shipment.awbCode)}</p></div>
        <div class="eta"><span>Estimated delivery</span><strong>${esc(live.estimatedDelivery ? formatDate(live.estimatedDelivery) : 'To be updated')}</strong></div>
      </div>
      <div class="tracking-events">
        ${events.map((activity) => `<div class="tracking-event">
          <span class="event-dot" aria-hidden="true"></span>
          <div class="event-copy"><strong>${esc(activity.status || 'Shipment update')}</strong><p>${esc(activity.activity || '')}${activity.location ? ` · ${esc(activity.location)}` : ''}${activity.date ? `<br>${esc(formatDateTime(activity.date))}` : ''}</p></div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  function renderTrackingOrder(order) {
    const shipment = order.shipment || {};
    return `<article class="order-card">
      <div class="order-card__body">
        ${renderProductRows(order, { courier: shipment.courierName || '' })}
        ${renderProgress(order)}
        ${renderTrackingEvents(order)}
      </div>
    </article>`;
  }

  function renderEmpty(title, text) {
    return `<div class="empty"><div class="empty-icon" aria-hidden="true">⌁</div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
  }

  function renderSkeletons() {
    resultEl.innerHTML = Array.from({ length: 2 }, () => '<div class="skeleton-card" aria-hidden="true"><div class="skeleton-body"><div class="skeleton-body-line"></div><div class="skeleton-product"></div></div></div>').join('');
  }

  function matchesFilter(order, filter) {
    if (filter === 'delivered') return rawFulfillment(order) === 'Delivered';
    return true;
  }

  function renderOrderList() {
    if (mode !== 'list') return;
    const query = normalize(searchInput?.value);
    const filter = filterSelect?.value || 'all';
    const filtered = loadedOrders.filter((order) => {
      const haystack = normalize([order.id, order.receipt, order.items, order.fulfillmentStatus, order.customer?.address].join(' '));
      return (!query || haystack.includes(query)) && matchesFilter(order, filter);
    });

    if (countEl) countEl.textContent = `${filtered.length} of ${loadedOrders.length} order${loadedOrders.length === 1 ? '' : 's'}`;
    setMessage('');
    resultEl.innerHTML = filtered.length
      ? filtered.map(renderSummaryOrder).join('')
      : renderEmpty('No matching orders', 'Try another search or choose a different filter.');
  }

  async function loadOrders() {
    setMessage(mode === 'list' ? 'Loading your orders…' : 'Loading shipment tracking…');
    renderSkeletons();
    if (refreshBtn) refreshBtn.disabled = true;

    try {
      const data = await requestJson('/api/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });

      accountMobile.textContent = data.mobile || accountMobile.textContent;
      loadedOrders = (Array.isArray(data.orders) ? data.orders : []).filter(isPaid);

      if (mode === 'track') {
        const trackable = loadedOrders.filter((order) => rawFulfillment(order) !== 'Cancelled');
        if (countEl) countEl.textContent = `${trackable.length} order${trackable.length === 1 ? '' : 's'}`;
        setMessage('');
        resultEl.innerHTML = trackable.length
          ? trackable.map(renderTrackingOrder).join('')
          : renderEmpty('No trackable orders yet', 'Confirmed orders will appear here automatically.');
        return;
      }

      if (!loadedOrders.length) {
        if (countEl) countEl.textContent = '0 orders';
        setMessage('');
        resultEl.innerHTML = renderEmpty('No confirmed orders found', 'Successfully paid orders placed with this mobile number will appear here.');
        return;
      }

      renderOrderList();
    } catch (error) {
      resultEl.innerHTML = '';
      if (countEl) countEl.textContent = 'Could not load orders';
      if (error.message !== 'Login required.') setMessage(error.message, 'error');
    } finally {
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  async function initialize() {
    setMessage('Checking your login…');
    renderSkeletons();
    try {
      const session = await requestJson('/api/customer/auth/session');
      if (!session.authenticated) {
        location.replace(loginUrl());
        return;
      }
      accountMobile.textContent = session.mobile || 'Verified customer';
      await loadOrders();
    } catch (error) {
      resultEl.innerHTML = '';
      setMessage(error.message, 'error');
    }
  }

  logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    try {
      await requestJson('/api/customer/auth/logout', { method: 'POST' });
    } catch {}
    location.replace('/login.html');
  });

  if (refreshBtn) refreshBtn.addEventListener('click', loadOrders);
  if (searchInput) searchInput.addEventListener('input', renderOrderList);
  if (filterSelect) filterSelect.addEventListener('change', renderOrderList);

  initialize();
})();
