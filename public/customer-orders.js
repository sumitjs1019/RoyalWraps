(() => {
  const mode = document.body.dataset.orderMode;
  const form = document.getElementById('customerOrderForm');
  const messageEl = document.getElementById('orderMessage');
  const resultEl = document.getElementById('orderResults');
  if (!form || !messageEl || !resultEl || !['list', 'track'].includes(mode)) return;

  const stages = ['New', 'Processing', 'Printed', 'Shipped', 'Delivered'];
  const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function setMessage(text, type = '') {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`.trim();
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
      <div class="order-head">
        <div><h3>${esc(order.receipt || order.id)}</h3><div class="meta">${order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : 'Date unavailable'}<br>Order ID: ${esc(order.id)}</div></div>
        <div class="amount">${money.format(order.amountPaid || 0)}</div>
      </div>
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
      <div class="order-head">
        <div><h3>${esc(order.receipt || order.id)}</h3><div class="meta">${order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : 'Date unavailable'}<br>Order ID: ${esc(order.id)}</div></div>
        <div class="amount">${money.format(order.amountPaid || 0)}</div>
      </div>
      <div class="badges"><span class="badge">Payment: ${esc(order.paymentStatus)}</span><span class="badge">Order: ${esc(current)}</span>${shipment.awbCode ? `<span class="badge">AWB: ${esc(shipment.awbCode)}</span>` : ''}</div>
      <div class="status-track">${renderStatus(order)}</div>
      <div class="details"><div class="box"><strong>Products</strong><br>${esc(order.items || 'Product details unavailable')}</div><div class="box"><strong>Delivery</strong><br>${shipment.courierName ? esc(shipment.courierName) : 'Courier not assigned yet'}<br>${shipment.shiprocketStatus ? esc(shipment.shiprocketStatus) : 'Shipment preparation in progress'}${order.customer?.pincode ? `<br>PIN: ${esc(order.customer.pincode)}` : ''}</div></div>
      ${shipment.awbCode ? `<div class="tracking"><strong>Live Tracking</strong><div class="meta">${esc(live.currentStatus || shipment.shiprocketStatus || 'Tracking will update soon')}${live.estimatedDelivery ? `<br>Estimated delivery: ${esc(live.estimatedDelivery)}` : ''}</div>${activities}</div>` : '<div class="tracking meta">Live tracking will become available after the courier and AWB are assigned.</div>'}
    </article>`;
  }

  async function lookup(payload) {
    setMessage(mode === 'list' ? 'Loading your orders...' : 'Loading tracking details...');
    resultEl.innerHTML = '';
    try {
      const response = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load order details.');
      const orders = data.orders || [];
      if (!orders.length) {
        setMessage('No matching order found. Check the entered details.', 'error');
        resultEl.innerHTML = '<div class="empty">No order matched these details.</div>';
        return;
      }
      setMessage(mode === 'list' ? `${orders.length} order${orders.length > 1 ? 's' : ''} found.` : 'Order found.', 'success');
      resultEl.innerHTML = orders.map(mode === 'list' ? renderSummaryOrder : renderTrackingOrder).join('');
    } catch (error) {
      setMessage(error.message, 'error');
    }
  }

  form.querySelectorAll('input[name="mobile"]').forEach((input) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 10);
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const mobile = data.get('mobile');
    if (mode === 'list') {
      lookup({ mode: 'list', email: String(data.get('email') || '').trim(), mobile });
    } else {
      lookup({ mode: 'track', orderId: String(data.get('orderId') || '').trim(), mobile });
    }
  });
})();