(() => {
  const form = document.getElementById('loginForm');
  const mobileInput = document.getElementById('mobileInput');
  const otpInput = document.getElementById('otpInput');
  const otpStage = document.getElementById('otpStage');
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  const resendOtpBtn = document.getElementById('resendOtpBtn');
  const messageEl = document.getElementById('loginMessage');
  if (!form || !mobileInput || !otpInput || !otpStage || !sendOtpBtn || !verifyOtpBtn || !resendOtpBtn || !messageEl) return;

  const allowedReturns = new Set(['/my-orders.html', '/track-order.html']);
  const requestedReturn = new URLSearchParams(location.search).get('return');
  const returnPath = allowedReturns.has(requestedReturn) ? requestedReturn : '/my-orders.html';
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

  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
    return data;
  }

  async function postJson(url, payload) {
    return requestJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
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

  async function sendOtp() {
    const mobile = cleanMobile();
    mobileInput.value = mobile;
    if (!validMobile(mobile)) {
      setMessage('Enter a valid 10-digit Indian mobile number.', 'error');
      mobileInput.focus();
      return;
    }

    sendOtpBtn.disabled = true;
    resendOtpBtn.disabled = true;
    setMessage('Sending OTP to your mobile number...');
    try {
      await postJson('/api/customer/auth/send-otp', { mobile });
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

  async function verifyOtp() {
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
    setMessage('Verifying OTP and signing you in...');
    try {
      await postJson('/api/customer/auth/verify-otp', { mobile, code });
      setMessage('Login successful. Opening your orders...', 'success');
      location.replace(returnPath);
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
      setMessage('Mobile number changed. Request a new OTP.');
    }
  });

  otpInput.addEventListener('input', () => {
    otpInput.value = otpInput.value.replace(/\D/g, '').slice(0, 10);
  });

  sendOtpBtn.addEventListener('click', sendOtp);
  resendOtpBtn.addEventListener('click', sendOtp);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    verifyOtp();
  });

  requestJson('/api/customer/auth/session')
    .then((session) => {
      if (session.authenticated) location.replace(returnPath);
    })
    .catch(() => {});
})();
