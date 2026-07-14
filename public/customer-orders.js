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

  const stages = ['New', 'Processing', 'Printed', 'Shipped', 'Delivered'];
  const money = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  });

  let loadedOrders = [];

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

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

  function formatDate(value, options = {}) {
    if (!value) return 'Date unavailable';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...options
    }).format(date);
  }

  function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isPaymentFailed(order) {
    return ['failed', 'cancelled', 'canceled'].includes(normalize(order.paymentStatus));
  }

  function isPaid(order) {
    return ['captured', 'paid'].includes(normalize(order.paymentStatus));
  }

  function normalizedFulfillment(order) {
    const raw = String(order.fulfillmentStatus || 'New').trim();
    const match = stages.find((stage) => stage.toLowerCase() === raw.toLowerCase());
    if (match) return match;
    if (['cancelled', 'canceled'].includes(raw.toLowerCase())) return 'Cancelled';
    return 'New';
  }

  function paymentLabel(order) {
    const status = normalize(order.paymentStatus);
    if (isPaymentFailed(order)) return 'Failed';
    if (isPaid(order)) return 'Paid';
    if (status === 'authorized') return 'Authorized';
    return 'Pending';
  }

  function statusView(order) {
    if (isPaymentFailed(order)) {
      return {
        title: 'Payment failed',
        description: 'This payment was not completed, so the order was not confirmed.',
        tone: 'danger',
        pill: 'Action needed'
      };
    }

    if (!isPaid(order)) {
      return {
        title: 'Payment pending',
        description: 'We are waiting for payment confirmation. Fulfilment will start after payment is captured.',
        tone: 'warning',
        pill: 'Pending'
      };
    }

    const status = normalizedFulfillment(order);
    const views = {
      New: {
        title: 'Order confirmed',
        description: 'Your payment is confirmed and the order has been received.',
        tone: 'success',
        pill: 'Confirmed'
      },
      Processing: {
        title: 'Preparing your order',
        description: 'Your mobile skin details are being checked before printing.',
        tone: 'info',
        pill: 'Processing'
      },
      Printed: {
        title: 'Your skin is printed',
        description: 'Quality checks and secure packing are in progress.',
        tone: 'info',
        pill: 'Printed'
      },
      Shipped: {
        title: 'Your order is on the way',
        description: 'The courier has picked up your package. Track the latest movement below.',
        tone: 'success',
        pill: 'Shipped'
      },
      Delivered: {
        title: 'Delivered',
        description: 'Your RoyalWrap order has been delivered successfully.',
        tone: 'success',
        pill: 'Delivered'
      },
      Cancelled: {
        title: 'Order cancelled',
        description: 'This order will not move forward for fulfilment.',
        tone: 'danger',
        pill: 'Cancelled'
      }
    };
    return views[status] || views.New;
  }

  function paymentMethodLabel(value) {
    const method = normalize(value);
    const labels = {
      upi: 'UPI',
      card: 'Card',
      netbanking: 'Netbanking',
      wallet: 'Wallet',
      emi: 'EMI',
      paylater: 'Pay Later'
    };
    return labels[method] || (value ? String(value) : 'Not available');
  }

  function shortOrderId(order) {
    const id = String(order.id || order.receipt || '');
    if (id.length <= 14) return id;
    return `…${id.slice(-12)}`;
  }

  function productTitle(order) {
    const items = String(order.items || '').trim();
    return items || 'RoyalWrap mobile skin';
  }

  function renderProgress(order) {
    if (!isPaid(order) || normalizedFulfillment(order) === 'Cancelled') return '';
    const current = normalizedFulfillment(order);
    const currentIndex = Math.max(0, stages.indexOf(current));
    const fill = currentIndex === 0 ? 0 : (currentIndex / (stages.length - 1)) * 80;

    return `<div class="order-progress" aria-label="Order progress: ${esc(current)}">
      <span class="progress-fill" style="width:${fill}%"></span>
      ${stages.map((stage, index) => {
        const done = index <= currentIndex;
        const currentClass = index === currentIndex ? ' current' : '';
        return `<div class="progress-step ${done ? 'done' : ''}${currentClass}">
          <span class="progress-dot" aria-hidden="true">${done ? '✓' : ''}</span>
          <span>${esc(stage)}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function locationIcon() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>`;
  }

  function renderActions(order, trackingPage = false) {
    if (isPaymentFailed(order)) {
      return `<div class="product-actions"><a class="action-button primary single" href="/">Place order again</a></div>`;
    }

    const fulfillment = normalizedFulfillment(order);
    if (trackingPage) {
      return `<div class="product-actions"><a class="action-button" href="my-orders.html">Order details</a><a class="action-button primary" href="/">Shop again</a></div>`;
    }

    if (isPaid(order) && !['Delivered', 'Cancelled'].includes(fulfillment)) {
      return `<div class="product-actions"><a class="action-button primary" href="track-order.html">Track package</a><a class="action-button" href="/">Shop again</a></div>`;
    }

    return `<div class="product-actions"><a class="action-button primary single" href="/">Buy again</a></div>`;
  }

  function renderHeader(order) {
    const payment = paymentLabel(order);
    return `<div class="order-card__top">
      <div class="order-meta-block"><span>Order placed</span><time datetime="${esc(order.createdAt || '')}">${esc(formatDate(order.createdAt))}</time></div>
      <div class="order-meta-block"><span>Total</span><strong>${esc(money.format(Number(order.amountPaid || 0)))}</strong></div>
      <div class="order-meta-block"><span>Payment</span><strong>${esc(payment)}</strong></div>
      <div class="order-meta-block order-number"><span>Order #</span><strong title="${esc(order.id || '')}">${esc(shortOrderId(order))}</strong></div>
    </div>`;
  }

  function renderDetails(order) {
    const shipment = order.shipment || {};
    return `<details class="order-details">
      <summary>View complete order details</summary>
      <div class="details-grid">
        <div class="detail-box"><span>Full order ID</span><strong>${esc(order.id || 'Unavailable')}</strong></div>
        <div class="detail-box"><span>Payment method</span><strong>${esc(paymentMethodLabel(order.paymentMethod))}</strong></div>
        <div class="detail-box"><span>Delivery PIN</span><strong>${esc(order.customer?.pincode || 'Not available')}</strong></div>
        <div class="detail-box"><span>Courier</span><strong>${esc(shipment.courierName || 'Not assigned')}</strong></div>
        <div class="detail-box"><span>AWB number</span><strong>${esc(shipment.awbCode || 'Not assigned')}</strong></div>
        <div class="detail-box"><span>Last updated</span><strong>${esc(formatDateTime(shipment.updatedAt || order.statusUpdatedAt) || 'Not available')}</strong></div>
      </div>
    </details>`;
  }

  function renderSummaryOrder(order) {
    const view = statusView(order);
    const fulfillment = normalizedFulfillment(order);
    const deliveryText = order.customer?.pincode
      ? `Delivery location PIN ${esc(order.customer.pincode)}`
      : 'Delivery location will appear after confirmation';

    return `<article class="order-card">
      ${renderHeader(order)}
      <div class="order-card__body">
        <div class="status-summary">
          <div class="status-copy ${view.tone}"><h3>${esc(view.title)}</h3><p>${esc(view.description)}</p></div>
          <span class="status-pill ${view.tone}">${esc(view.pill)}</span>
        </div>
        <div class="product-row">
          <div class="product-thumb"><img src="assets/royalwraps-logo-icon.png" alt="RoyalWrap product"></div>
          <div class="product-info">
            <h4>${esc(productTitle(order))}</h4>
            <p>${isPaymentFailed(order) ? 'Payment was unsuccessful. No product was sent for fulfilment.' : `Current order stage: ${esc(fulfillment)}`}</p>
            <div class="delivery-note">${locationIcon()}<span>${deliveryText}</span></div>
          </div>
          ${renderActions(order)}
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
      return `<div class="no-tracking"><span class="no-tracking-icon" aria-hidden="true">i</span><div><strong>Tracking is not available yet</strong>Courier and AWB details will appear here after your packed order is handed over for shipping.</div></div>`;
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
    const view = statusView(order);
    const fulfillment = normalizedFulfillment(order);
    const shipment = order.shipment || {};
    const deliveryText = order.customer?.pincode
      ? `Delivering to PIN ${esc(order.customer.pincode)}`
      : 'Delivery PIN not available';

    return `<article class="order-card">
      ${renderHeader(order)}
      <div class="order-card__body">
        <div class="status-summary">
          <div class="status-copy ${view.tone}"><h3>${esc(view.title)}</h3><p>${esc(view.description)}</p></div>
          <span class="status-pill ${view.tone}">${esc(view.pill)}</span>
        </div>
        <div class="product-row">
          <div class="product-thumb"><img src="assets/royalwraps-logo-icon.png" alt="RoyalWrap product"></div>
          <div class="product-info">
            <h4>${esc(productTitle(order))}</h4>
            <p>${shipment.courierName ? `Courier: ${esc(shipment.courierName)}` : `Current order stage: ${esc(fulfillment)}`}</p>
            <div class="delivery-note">${locationIcon()}<span>${deliveryText}</span></div>
          </div>
          ${renderActions(order, true)}
        </div>
        ${renderProgress(order)}
        ${renderTrackingEvents(order)}
        ${renderDetails(order)}
      </div>
    </article>`;
  }

  function renderEmpty(title, text, showShopButton = true) {
    return `<div class="empty"><div class="empty-icon" aria-hidden="true">⌁</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${showShopButton ? '<a class="action-button primary" href="/">Continue shopping</a>' : ''}</div>`;
  }

  function renderSkeletons() {
    resultEl.innerHTML = Array.from({ length: 2 }, () => `<div class="skeleton-card" aria-hidden="true"><div class="skeleton-top"></div><div class="skeleton-body"><div class="skeleton-body-line"></div><div class="skeleton-product"></div></div></div>`).join('');
  }

  function matchesFilter(order, filter) {
    if (filter === 'all') return true;
    if (filter === 'payment-failed') return isPaymentFailed(order);
    if (filter === 'delivered') return normalizedFulfillment(order) === 'Delivered' && isPaid(order);
    if (filter === 'active') return isPaid(order) && !['Delivered', 'Cancelled'].includes(normalizedFulfillment(order));
    return true;
  }

  function renderOrderList() {
    if (mode !== 'list') return;
    const query = normalize(searchInput?.value);
    const filter = filterSelect?.value || 'all';
    const filtered = loadedOrders.filter((order) => {
      const haystack = normalize([order.id, order.receipt, order.items, order.paymentStatus, order.fulfillmentStatus].join(' '));
      return (!query || haystack.includes(query)) && matchesFilter(order, filter);
    });

    if (countEl) countEl.textContent = `${filtered.length} of ${loadedOrders.length} order${loadedOrders.length === 1 ? '' : 's'}`;
    setMessage('');

    if (!filtered.length) {
      resultEl.innerHTML = renderEmpty('No matching orders', 'Try another search or choose a different order filter.', false);
      return;
    }
    resultEl.innerHTML = filtered.map(renderSummaryOrder).join('');
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
      loadedOrders = Array.isArray(data.orders) ? data.orders : [];

      if (mode === 'track') {
        const trackable = loadedOrders.filter((order) => isPaid(order) && normalizedFulfillment(order) !== 'Cancelled');
        if (countEl) countEl.textContent = `${trackable.length} trackable order${trackable.length === 1 ? '' : 's'}`;
        setMessage('');
        if (!trackable.length) {
          resultEl.innerHTML = renderEmpty('No trackable orders yet', 'Paid orders will appear here as soon as they are confirmed.');
          return;
        }
        resultEl.innerHTML = trackable.map(renderTrackingOrder).join('');
        return;
      }

      if (!loadedOrders.length) {
        if (countEl) countEl.textContent = '0 orders';
        setMessage('');
        resultEl.innerHTML = renderEmpty('No orders found', 'Orders placed with this verified mobile number will appear here automatically.');
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
