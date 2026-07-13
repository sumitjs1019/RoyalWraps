(() => {
  const mode = document.body.dataset.orderMode;
  const accountMobile = document.getElementById('accountMobile');
  const logoutBtn = document.getElementById('logoutBtn');
  const refreshBtn = document.getElementById('refreshOrdersBtn');
  const messageEl = document.getElementById('orderMessage');
  const resultEl = document.getElementById('orderResults');
  if (!accountMobile || !logoutBtn || !messageEl || !resultEl || !['list', 'track'].includes(mode)) return;

  const stages = ['New', 'Processing', 'Printed', 'Shipped', 'Delivered'];
  const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

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

  function renderStatus(order) {
    const current = order.fulfillmentStatus || 'New';
    const currentIndex = stages.indexOf(current);
    return stages.map((stage, index) => (
      `<div class="step ${current !== 'Cancelled' && index <= currentIndex ? 'done' : ''}">${esc(stage)}</div>`
    )).join('');
  }

  function renderSummaryOrder(order) {
    const shipment = order.shipment || {};
    const current = order.fulfillmentStatus || 'New';
    return `<article class="order">
      <div class="order-head"><div><h3>${esc(order.receipt || order.id)}</h3><div class="meta">${order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : 'Date unavailable'}<br>Order ID: ${esc(order.id)}</div></div><div class="amount">${money.format(order.amountPaid || 0)}</div></div>
      <div class="badges"><span class="badge">Payment: ${esc(order.paymentStatus)}</span><span class="badge">Order: ${esc(current)}</span>${shipment.courierName ? `<span class="badge">Courier: ${esc(shipment.courierName)}</span>` : ''}</div>
      <div class="status-track">${renderStatus(order)}</div>
      <div class="details"><div class="box"><strong>Products</strong><br>${esc(order.items || 'Product details unavailable')}</div><div class="box"><strong>Shipment</strong><br>${shipment.awbCode ? `AWB: ${esc(shipment.awbCode)}` : 'Courier and AWB not assigned yet'}${order.customer?.pincode ? `<br>PIN: ${esc(order.customer.pincode)}` : ''}</div></div>
    </article>`;
  }

  function renderTrackingOrder(order) {
    const shipment = order.shipment || {};
    const live = order.liveTracking || {};
    const current = order.fulfillmentStatus || 'New';
    const activities = (live.activities || []).map((activity) => `<div class="activity"><strong>${esc(activity.status || activity.activity || 'Update')}</strong><div class="meta">${esc(activity.activity || '')}${activity.location ? ` · ${esc(activity.location)}` : ''}<br>${esc(activity.date || '')}</div></div>`).join('');
    return `<article class="order">
      <div class="order-head"><div><h3>${esc(order.receipt || order.id)}</h3><div class="meta">${order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : 'Date unavailable'}<br>Order ID: ${esc(order.id)}</div></div><div class="amount">${money.format(order.amountPaid || 0)}</div></div>
      <div class="badges"><span class="badge">Payment: ${esc(order.paymentStatus)}</span><span class="badge">Order: ${esc(current)}</span>${shipment.awbCode ? `<span class="badge">AWB: ${esc(shipment.awbCode)}</span>` : ''}</div>
      <div class="status-track">${renderStatus(order)}</div>
      <div class="details"><div class="box"><strong>Products</strong><br>${esc(order.items || 'Product details unavailable')}</div><div class="box"><strong>Delivery</strong><br>${shipment.courierName ? esc(shipment.courierName) : 'Courier not assigned yet'}<br>${shipment.shiprocketStatus ? esc(shipment.shiprocketStatus) : 'Shipment preparation in progress'}${order.customer?.pincode ? `<br>PIN: ${esc(order.customer.pincode)}` : ''}</div></div>
      ${shipment.awbCode ? `<div class="tracking"><strong>Live Tracking</strong><div class="meta">${esc(live.currentStatus || shipment.shiprocketStatus || 'Tracking will update soon')}${live.estimatedDelivery ? `<br>Estimated delivery: ${esc(live.estimatedDelivery)}` : ''}</div>${activities}</div>` : '<div class="tracking meta">Live tracking will become available after the courier and AWB are assigned.</div>'}
    </article>`;
  }

  async function loadOrders() {
    setMessage(mode === 'list' ? 'Loading your orders...' : 'Loading shipment tracking...');
    resultEl.innerHTML = '';
    if (refreshBtn) refreshBtn.disabled = true;
    try {
      const data = await requestJson('/api/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      const orders = data.orders || [];
      accountMobile.textContent = data.mobile || accountMobile.textContent;
      if (!orders.length) {
        setMessage('No orders were found for your logged-in mobile number.', 'error');
        resultEl.innerHTML = '<div class="empty">No RoyalWrap order is linked to this account yet.</div>';
        return;
      }
      setMessage(mode === 'list' ? `${orders.length} order${orders.length > 1 ? 's' : ''} found.` : `${orders.length} shipment${orders.length > 1 ? 's' : ''} found.`, 'success');
      resultEl.innerHTML = orders.map(mode === 'list' ? renderSummaryOrder : renderTrackingOrder).join('');
    } catch (error) {
      if (error.message !== 'Login required.') setMessage(error.message, 'error');
    } finally {
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  async function initialize() {
    setMessage('Checking your login...');
    try {
      const session = await requestJson('/api/customer/auth/session');
      if (!session.authenticated) {
        location.replace(loginUrl());
        return;
      }
      accountMobile.textContent = session.mobile || 'Verified customer';
      await loadOrders();
    } catch (error) {
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
  initialize();
})();