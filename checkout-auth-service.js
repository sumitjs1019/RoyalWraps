'use strict';

const {
  configured,
  digits,
  sendOtp,
  checkOtp,
  createSessionToken,
  readSessionToken,
  sessionTtlSeconds,
  limitOtpSend,
  limitOtpVerify
} = require('./otp-service');

const SESSION_COOKIE = 'rw_customer_session';

function send(res, status, payload, extraHeaders = {}) {
  const text = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(text);
}

function readBody(req, limit = 32768) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('Invalid request.'), { statusCode: 400 }));
      }
    });

    req.on('error', reject);
  });
}

function validMobile(value) {
  const mobile = digits(value);
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw Object.assign(new Error('Enter a valid 10-digit Indian mobile number.'), { statusCode: 400 });
  }
  return mobile;
}

function parseCookies(req) {
  const result = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const rawValue = part.slice(index + 1).trim();
    try { result[key] = decodeURIComponent(rawValue); } catch { result[key] = rawValue; }
  }
  return result;
}

function isSecureRequest(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return forwardedProto === 'https' || process.env.NODE_ENV === 'production';
}

function createCookie(req, token) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${sessionTtlSeconds()}`,
    isSecureRequest(req) ? 'Secure' : ''
  ].filter(Boolean).join('; ');
}

function sessionFromRequest(req) {
  if (!configured()) return null;
  const token = parseCookies(req)[SESSION_COOKIE];
  return token ? readSessionToken(token) : null;
}

function maskedMobile(mobile) {
  const clean = digits(mobile);
  return clean ? `+91 ${clean.slice(0, 2)}******${clean.slice(-2)}` : '';
}

async function handleCheckoutOtpSend(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
    if (!configured()) return send(res, 503, { error: 'Mobile OTP is not configured on the server.' });

    const input = await readBody(req);
    const mobile = validMobile(input.mobile);
    limitOtpSend(req, mobile);
    await sendOtp(mobile);

    return send(res, 200, {
      success: true,
      message: 'OTP sent to your mobile number.',
      mobile: maskedMobile(mobile)
    });
  } catch (error) {
    console.error('Checkout OTP send failed:', error.providerMessage || error.message);
    return send(res, error.statusCode || 500, { error: error.message || 'Could not send OTP.' });
  }
}

async function handleCheckoutOtpVerify(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
    if (!configured()) return send(res, 503, { error: 'Mobile OTP is not configured on the server.' });

    const input = await readBody(req);
    const mobile = validMobile(input.mobile);
    limitOtpVerify(req, mobile);
    await checkOtp(mobile, input.code);

    const token = createSessionToken(mobile);
    return send(res, 200, {
      success: true,
      authenticated: true,
      mobile: maskedMobile(mobile),
      mobileNumber: mobile,
      expiresInDays: Math.round(sessionTtlSeconds() / 86400)
    }, { 'Set-Cookie': createCookie(req, token) });
  } catch (error) {
    console.error('Checkout OTP verification failed:', error.providerMessage || error.message);
    return send(res, error.statusCode || 500, { error: error.message || 'Could not verify OTP.' });
  }
}

function handleCheckoutSession(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });
    const session = sessionFromRequest(req);
    if (!session) return send(res, 200, { authenticated: false });

    return send(res, 200, {
      authenticated: true,
      mobile: maskedMobile(session.mobile),
      mobileNumber: session.mobile,
      expiresAt: new Date(Number(session.exp) * 1000).toISOString()
    });
  } catch (error) {
    return send(res, error.statusCode || 500, { error: error.message || 'Could not check checkout login.' });
  }
}

module.exports = {
  handleCheckoutOtpSend,
  handleCheckoutOtpVerify,
  handleCheckoutSession,
  sessionFromRequest
};
