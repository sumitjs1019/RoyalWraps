(() => {
  const form = document.getElementById('checkoutForm');
  const mobileInput = form?.querySelector('input[name="mobile"]');
  const authBox = document.getElementById('checkoutAuth');
  const sendButton = document.getElementById('checkoutSendOtp');
  const otpStage = document.getElementById('checkoutOtpStage');
  const otpInput = document.getElementById('checkoutOtpInput');
  const verifyButton = document.getElementById('checkoutVerifyOtp');
  const resendButton = document.getElementById('checkoutResendOtp');
  const changeButton = document.getElementById('checkoutChangeMobile');
  const authStatus = document.getElementById('checkoutAuthStatus');
  const checkoutStatus = document.getElementById('checkoutStatus');

  if (!form || !mobileInput || !authBox || !sendButton || !otpStage || !otpInput || !verifyButton || !resendButton || !changeButton || !authStatus) return;

  let sentMobile = '';
  let verifiedMobile = '';
  let cooldownTimer = null;
  let sessionReady;

  function cleanMobile(value = mobileInput.value) {
    return String(value || '').replace(/\D/g, '').slice(0, 10);
  }

  function validMobile(mobile) {
    return /^[6-9]\d{9}$/.test(mobile);
  }

  function setMessage(text, type = '') {
    authStatus.textContent = text;
    authStatus.className = `checkout-auth-status ${type}`.trim();
  }

  function setCheckoutMessage(text, type = '') {
    if (!checkoutStatus) return;
    checkoutStatus.textContent = text;
    checkoutStatus.className = `form-note ${type}`.trim();
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
    return data;
  }

  function postJson(url, payload) {
    return requestJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  function setVerified(mobile, masked = '') {
    verifiedMobile = cleanMobile(mobile);
    const isVerified = validMobile(verifiedMobile);

    authBox.classList.toggle('is-verified', isVerified);
    mobileInput.readOnly = isVerified;
    sendButton.hidden = isVerified;
    otpStage.hidden = true;
    changeButton.hidden = !isVerified;

    if (isVerified) {
      mobileInput.value = verifiedMobile;
      sentMobile = verifiedMobile;
      otpInput.value = '';
      setMessage(`Mobile verified: ${masked || `+91 ${verifiedMobile.slice(0, 2)}******${verifiedMobile.slice(-2)}`}`, 'success');
      setCheckoutMessage('Mobile verified. You can continue to secure payment.', 'success');
    } else {
      verifiedMobile = '';
      sentMobile = '';
      mobileInput.readOnly = false;
      otpInput.value = '';
      setMessage('Verify your mobile number before payment.');
      setCheckoutMessage('Prepaid Orders Only');
    }
  }

  function setCooldown(seconds = 60) {
    clearInterval(cooldownTimer);
    let remaining = seconds;
    resendButton.disabled = true;
    resendButton.textContent = `Resend in ${remaining}s`;

    cooldownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(cooldownTimer);
        resendButton.disabled = false;
        resendButton.textContent = 'Resend OTP';
        return;
      }
      resendButton.textContent = `Resend in ${remaining}s`;
    }, 1000);
  }

  async function checkSession() {
    try {
      const session = await requestJson('/api/checkout/auth/session');
      if (session.authenticated && validMobile(cleanMobile(session.mobileNumber))) {
        setVerified(session.mobileNumber, session.mobile);
        return session.mobileNumber;
      }
    } catch {
      // A missing/expired session simply means OTP verification is required.
    }
    setVerified('');
    return '';
  }

  async function sendOtp() {
    const mobile = cleanMobile();
    mobileInput.value = mobile;

    if (!validMobile(mobile)) {
      setMessage('Enter a valid 10-digit Indian mobile number.', 'error');
      mobileInput.focus();
      return;
    }

    sendButton.disabled = true;
    resendButton.disabled = true;
    setMessage('Sending OTP to your mobile number...');

    try {
      const data = await postJson('/api/checkout/auth/send-otp', { mobile });
      sentMobile = mobile;
      otpStage.hidden = false;
      otpInput.value = '';
      otpInput.focus();
      setCooldown(60);
      setMessage(`OTP sent to ${data.mobile || `+91 ${mobile.slice(0, 2)}******${mobile.slice(-2)}`}.`, 'success');
    } catch (error) {
      setMessage(error.message, 'error');
    } finally {
      sendButton.disabled = false;
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

    verifyButton.disabled = true;
    setMessage('Verifying OTP...');

    try {
      const data = await postJson('/api/checkout/auth/verify-otp', { mobile, code });
      setVerified(data.mobileNumber || mobile, data.mobile);
    } catch (error) {
      setMessage(error.message, 'error');
    } finally {
      verifyButton.disabled = false;
    }
  }

  async function changeMobile() {
    changeButton.disabled = true;
    try {
      await postJson('/api/customer/auth/logout', {});
    } catch {
      // Unlock locally even if the expired server session is already gone.
    }
    clearInterval(cooldownTimer);
    setVerified('');
    mobileInput.value = '';
    mobileInput.focus();
    changeButton.disabled = false;
  }

  mobileInput.addEventListener('input', () => {
    mobileInput.value = cleanMobile();
    if (sentMobile && cleanMobile() !== sentMobile) {
      sentMobile = '';
      otpStage.hidden = true;
      otpInput.value = '';
      clearInterval(cooldownTimer);
      resendButton.disabled = true;
      resendButton.textContent = 'Resend OTP';
      setMessage('Mobile number changed. Request a new OTP.');
    }
  });

  otpInput.addEventListener('input', () => {
    otpInput.value = otpInput.value.replace(/\D/g, '').slice(0, 10);
  });

  sendButton.addEventListener('click', sendOtp);
  resendButton.addEventListener('click', sendOtp);
  verifyButton.addEventListener('click', verifyOtp);
  changeButton.addEventListener('click', changeMobile);

  form.addEventListener('submit', (event) => {
    const mobile = cleanMobile();
    if (validMobile(mobile) && mobile === verifiedMobile) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    Promise.resolve(sessionReady).then(() => {
      const refreshedMobile = cleanMobile();
      if (validMobile(refreshedMobile) && refreshedMobile === verifiedMobile) {
        form.requestSubmit();
        return;
      }

      setMessage('Payment se pehle mobile number OTP se verify karein.', 'error');
      setCheckoutMessage('Please verify your mobile number before payment.', 'error');
      authBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!validMobile(refreshedMobile)) mobileInput.focus();
      else if (!sentMobile) sendButton.focus();
      else otpInput.focus();
    });
  }, true);

  sessionReady = checkSession();
  window.RoyalWrapCheckoutAuth = {
    ready: sessionReady,
    getVerifiedMobile: () => verifiedMobile
  };
})();
