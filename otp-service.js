const https = require('https');
const crypto = require('crypto');

const TWOFACTOR_HOST = '2factor.in';
const sendAttempts = new Map();
const verifyAttempts = new Map();
const otpSessions = new Map();

function digits(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function validIndianMobile(value) {
  const mobile = digits(value);
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw Object.assign(new Error('Enter a valid 10-digit Indian mobile number.'), { statusCode: 400 });
  }
  return mobile;
}

function configured() {
  return Boolean(
    process.env.TWOFACTOR_API_KEY
    && process.env.CUSTOMER_OTP_SESSION_SECRET
  );
}

function assertConfigured() {
  if (!configured()) {
    throw Object.assign(new Error('Mobile OTP is not configured on the server.'), { statusCode: 503 });
  }
}

function requestIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function rateLimit(map, key, options) {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || now >= entry.resetAt) {
    map.set(key, { count: 1, resetAt: now + options.windowMs, lastAt: now });
    return;
  }
  if (options.cooldownMs && now - entry.lastAt < options.cooldownMs) {
    const waitSeconds = Math.ceil((options.cooldownMs - (now - entry.lastAt)) / 1000);
    throw Object.assign(new Error(`Please wait ${waitSeconds} seconds before requesting another OTP.`), { statusCode: 429 });
  }
  entry.count += 1;
  entry.lastAt = now;
  if (entry.count > options.max) {
    throw Object.assign(new Error('Too many OTP attempts. Please try again later.'), { statusCode: 429 });
  }
}

function limitOtpSend(req, mobile) {
  rateLimit(sendAttempts, `${requestIp(req)}:${digits(mobile)}`, {
    max: 5,
    windowMs: 15 * 60 * 1000,
    cooldownMs: 60 * 1000
  });
}

function limitOtpVerify(req, mobile) {
  rateLimit(verifyAttempts, `${requestIp(req)}:${digits(mobile)}`, {
    max: 10,
    windowMs: 15 * 60 * 1000,
    cooldownMs: 0
  });
}

function twoFactorRequest(apiPath) {
  assertConfigured();
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: TWOFACTOR_HOST,
      port: 443,
      path: apiPath,
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeout: 20000
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = { Details: text }; }
        const providerStatus = String(data.Status || data.status || '').toLowerCase();
        if (response.statusCode < 200 || response.statusCode >= 300 || providerStatus !== 'success') {
          const error = new Error(String(data.Details || data.details || data.Message || data.message || 'OTP service could not complete the request.'));
          error.statusCode = response.statusCode === 429 ? 429 : 502;
          error.providerMessage = error.message;
          return reject(error);
        }
        resolve(data);
      });
    });
    request.on('timeout', () => request.destroy(new Error('OTP service timed out.')));
    request.on('error', reject);
    request.end();
  });
}

function clearExpiredOtpSessions() {
  const now = Date.now();
  for (const [mobile, session] of otpSessions.entries()) {
    if (!session || session.expiresAt <= now) otpSessions.delete(mobile);
  }
}

async function sendOtp(value) {
  const mobile = validIndianMobile(value);
  clearExpiredOtpSessions();
  const apiKey = encodeURIComponent(String(process.env.TWOFACTOR_API_KEY || '').trim());
  const result = await twoFactorRequest(`/API/V1/${apiKey}/SMS/${encodeURIComponent(mobile)}/AUTOGEN`);
  const sessionId = String(result.Details || result.details || '').trim();
  if (!sessionId) {
    throw Object.assign(new Error('OTP service did not return a verification session.'), { statusCode: 502 });
  }
  otpSessions.set(mobile, {
    sessionId,
    expiresAt: Date.now() + (10 * 60 * 1000)
  });
  return { status: 'pending', to: mobile };
}

async function checkOtp(value, code) {
  const mobile = validIndianMobile(value);
  const cleanCode = String(code || '').replace(/\D/g, '').trim();
  if (!/^\d{4,10}$/.test(cleanCode)) {
    throw Object.assign(new Error('Enter the OTP sent to your mobile number.'), { statusCode: 400 });
  }
  clearExpiredOtpSessions();
  const otpSession = otpSessions.get(mobile);
  if (!otpSession) {
    throw Object.assign(new Error('OTP expired. Please request a new OTP.'), { statusCode: 401 });
  }
  const apiKey = encodeURIComponent(String(process.env.TWOFACTOR_API_KEY || '').trim());
  try {
    await twoFactorRequest(`/API/V1/${apiKey}/SMS/VERIFY/${encodeURIComponent(otpSession.sessionId)}/${encodeURIComponent(cleanCode)}`);
    otpSessions.delete(mobile);
    return true;
  } catch (error) {
    const providerText = String(error.providerMessage || error.message || '').toLowerCase();
    const publicError = Object.assign(
      new Error(providerText.includes('expired') ? 'OTP expired. Please request a new OTP.' : 'Incorrect OTP. Please check and try again.'),
      { statusCode: error.statusCode === 429 ? 429 : 401 }
    );
    publicError.providerMessage = error.providerMessage || error.message;
    throw publicError;
  }
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  return crypto
    .createHmac('sha256', String(process.env.CUSTOMER_OTP_SESSION_SECRET || ''))
    .update(value)
    .digest('base64url');
}

function sessionTtlSeconds() {
  const days = Math.min(Math.max(Number(process.env.CUSTOMER_SESSION_TTL_DAYS || 7), 1), 30);
  return Math.round(days * 24 * 60 * 60);
}

function createSessionToken(mobile) {
  assertConfigured();
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    mobile: digits(mobile),
    purpose: 'customer',
    iat: now,
    exp: now + sessionTtlSeconds(),
    nonce: crypto.randomBytes(16).toString('hex')
  }));
  return `${payload}.${sign(payload)}`;
}

function readSessionToken(token) {
  assertConfigured();
  const [payloadPart, signature] = String(token || '').split('.');
  if (!payloadPart || !signature) return null;
  const expected = sign(payloadPart);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (payload.purpose !== 'customer') return null;
    if (!/^[6-9]\d{9}$/.test(String(payload.mobile || ''))) return null;
    if (Number(payload.exp || 0) <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  configured,
  digits,
  sendOtp,
  checkOtp,
  createSessionToken,
  readSessionToken,
  sessionTtlSeconds,
  limitOtpSend,
  limitOtpVerify
};