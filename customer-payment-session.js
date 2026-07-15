const { digits, createSessionToken, sessionTtlSeconds } = require('./otp-service');

const SESSION_COOKIE = 'rw_customer_session';

function isSecureRequest(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return forwardedProto === 'https' || process.env.NODE_ENV === 'production';
}

function validMobile(value) {
  const mobile = digits(value);
  return /^[6-9]\d{9}$/.test(mobile) ? mobile : '';
}

function createPaymentVerifiedSessionCookie(req, value) {
  const mobile = validMobile(value);
  if (!mobile) return '';

  const token = createSessionToken(mobile);
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${sessionTtlSeconds()}`,
    isSecureRequest(req) ? 'Secure' : ''
  ].filter(Boolean).join('; ');
}

module.exports = { createPaymentVerifiedSessionCookie };
