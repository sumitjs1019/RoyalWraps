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

  function productTitle(order) {
    return String(order.items || '').trim() || 'RoyalWrap mobile skin';
  }

  function deliveryAddress(order) {
    return String(order.customer?.address || '').trim() || 'Delivery address is not available for this order.';
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
    const action = renderMyOrderAction(order);
    return `<article class="order-card">
      <div class="order-card__body">
        <div class="product-row ${action ? '' : 'no-actions'}">
          <div class="product-thumb"><img src="assets/royalwraps-logo-icon.png" alt="RoyalWrap product"></div>
          <div class="product-info">
            <h4>${esc(productTitle(order))}</h4>
            <div class="delivery-note">${locationIcon()}<span>${esc(deliveryAddress(order))}</span></div>
          </div>
          ${action}
        </div>
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
        <div class="product-row no-actions">
          <div class="product-thumb"><img src="assets/royalwraps-logo-icon.png" alt="RoyalWrap product"></div>
          <div class="product-info">
            <h4>${esc(productTitle(order))}</h4>
            ${shipment.courierName ? `<p>Courier: ${esc(shipment.courierName)}</p>` : ''}
            <div class="delivery-note">${locationIcon()}<span>${esc(deliveryAddress(order))}</span></div>
          </div>
        </div>
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
