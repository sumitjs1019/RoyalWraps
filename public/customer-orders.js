(() => {
  const mode = document.body.dataset.orderMode;
  const purpose = mode;
  const form = document.getElementById('customerOrderForm');
  const mobileInput = document.getElementById('mobileInput');
  const otpInput = document.getElementById('otpInput');
  const otpStage = document.getElementById('otpStage');
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  const resendOtpBtn = document.getElementById('resendOtpBtn');
  const messageEl = document.getElementById('orderMessage');
  const resultEl = document.getElementById('orderResults');

  if (!form || !mobileInput || !otpInput || !otpStage || !sendOtpBtn || !verifyOtpBtn || !resendOtpBtn || !messageEl || !resultEl || !['list', 'track'].includes(mode)) return;

  const stages = ['New', 'Processing', 'Printed', 'Shipped', 'Delivered'];
  const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let sentMobile = '';
  let cooldownTimer = null;

  function setMessage(text, type = '') {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`.trim();
  }

  function cleanMobile() {
    return mobileInput.value.replace(/\D/g, '').slice(0, 10);
  }

  function validMobile(mobile) {
    return /^[6-9]\d{9}$/.test(mobile);
  }

  function setCooldown(seconds = 60) {
    clearInterval(cooldownTimer);
    let remaining = seconds;
    resendOtpBtn.disabled = true;
    resendOtpBtn.textContent = `Resend OTP in ${remaining}s`;
    cooldownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(cooldownTimer);
        resendOtpBtn.disabled = false;
        resendOtpBtn.textContent = 'Resend OTP';
        return;
      }
      resendOtpBtn.textContent = `Resend OTP in ${remaining}s`;
    }, 1000);
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
    return data;
  }

  async function requestOtp() {
    const mobile = cleanMobile();
    mobileInput.value = mobile;
    if (!validMobile(mobile)) {
      setMessage('Enter a valid 10-digit Indian mobile number.', 'error');
      mobileInput.focus();
      return;
    }

    sendOtpBtn.disabled = true;
    resendOtpBtn.disabled = true;
    resultEl.innerHTML = '';
    setMessage('Sending OTP to your mobile number...');
    try {
      await postJson('/api/customer/otp/send', { mobile, purpose });
      sentMobile = mobile;
      otpStage.classList.remove('hidden');
      otpInput.value = '';
      otpInput.focus();
      setCooldown(60);
      setMessage(`OTP sent to +91 ${mobile.slice(0, 2)}******${mobile.slice(-2)}.`, 'success');
    } catch (error) {
      setMessage(error.message, 'error');
    } finally {
      sendOtpBtn.disabled = false;
    }
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

  async function loadOrders(mobile, token) {
    setMessage(mode === 'list' ? 'Loading your orders...' : 'Loading tracking details...');
    resultEl.innerHTML = '';
    const data = await postJson('/api/customer/orders', { mode, mobile, token });
    const orders = data.orders || [];
    if (!orders.length) {
      setMessage('No matching order found for this mobile number.', 'error');
      resultEl.innerHTML = '<div class="empty">No order matched this mobile number.</div>';
      return;
    }
    setMessage(mode === 'list' ? `${orders.length} order${orders.length > 1 ? 's' : ''} found.` : `${orders.length} shipment${orders.length > 1 ? 's' : ''} found.`, 'success');
    resultEl.innerHTML = orders.map(mode === 'list' ? renderSummaryOrder : renderTrackingOrder).join('');
  }

  async function verifyAndLoad() {
    const mobile = cleanMobile();
    const code = otpInput.value.replace(/\D/g, '').slice(0, 10);
    if (!validMobile(mobile) || mobile !== sentMobile) {
      setMessage('Request a fresh OTP for this mobile number.', 'error');
      return;
    }
    if (!/^\d{4,10}$/.test(code)) {
      setMessage('Enter the OTP sent to your mobile number.', 'error');
      otpInput.focus();
      return;
    }

    verifyOtpBtn.disabled = true;
    setMessage('Verifying OTP...');
    try {
      const verified = await postJson('/api/customer/otp/verify', { mobile, code, purpose });
      await loadOrders(mobile, verified.token);
    } catch (error) {
      setMessage(error.message, 'error');
    } finally {
      verifyOtpBtn.disabled = false;
    }
  }

  mobileInput.addEventListener('input', () => {
    mobileInput.value = cleanMobile();
    if (sentMobile && cleanMobile() !== sentMobile) {
      sentMobile = '';
      otpStage.classList.add('hidden');
      otpInput.value = '';
      clearInterval(cooldownTimer);
      resendOtpBtn.disabled = true;
      resendOtpBtn.textContent = 'Resend OTP';
      resultEl.innerHTML = '';
      setMessage('Mobile number changed. Request a new OTP.');
    }
  });

  otpInput.addEventListener('input', () => {
    otpInput.value = otpInput.value.replace(/\D/g, '').slice(0, 10);
  });

  sendOtpBtn.addEventListener('click', requestOtp);
  resendOtpBtn.addEventListener('click', requestOtp);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    verifyAndLoad();
  });
})();