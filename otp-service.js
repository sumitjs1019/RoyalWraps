const https = require('https');
const crypto = require('crypto');

const VERIFY_HOST = 'verify.twilio.com';
const sendAttempts = new Map();
const verifyAttempts = new Map();

function digits(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function e164India(value) {
  const mobile = digits(value);
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw Object.assign(new Error('Enter a valid 10-digit Indian mobile number.'), { statusCode: 400 });
  }
  return `+91${mobile}`;
}

function configured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_VERIFY_SERVICE_SID
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

function twilioFormRequest(apiPath, fields) {
  assertConfigured();
  const body = new URLSearchParams(fields).toString();
  const authorization = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString('base64');

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: VERIFY_HOST,
      port: 443,
      path: apiPath,
      method: 'POST',
      headers: {
        Authorization: `Basic ${authorization}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 20000
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch {}
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const publicMessage = response.statusCode === 404
            ? 'OTP expired or too many incorrect attempts. Request a new OTP.'
            : 'OTP service could not complete the request. Please try again.';
          const error = new Error(publicMessage);
          error.statusCode = response.statusCode === 429 ? 429 : 502;
          error.providerMessage = data.message || '';
          return reject(error);
        }
        resolve(data);
      });
    });
    request.on('timeout', () => request.destroy(new Error('OTP service timed out.')));
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

async function sendOtp(mobile) {
  const to = e164India(mobile);
  const serviceSid = encodeURIComponent(process.env.TWILIO_VERIFY_SERVICE_SID);
  const result = await twilioFormRequest(`/v2/Services/${serviceSid}/Verifications`, {
    To: to,
    Channel: 'sms'
  });
  if (!['pending', 'approved'].includes(String(result.status || ''))) {
    throw Object.assign(new Error('OTP could not be sent. Please try again.'), { statusCode: 502 });
  }
  return { status: result.status, to: digits(mobile) };
}

async function checkOtp(mobile, code) {
  const cleanCode = String(code || '').trim();
  if (!/^\d{4,10}$/.test(cleanCode)) {
    throw Object.assign(new Error('Enter the OTP sent to your mobile number.'), { statusCode: 400 });
  }
  const to = e164India(mobile);
  const serviceSid = encodeURIComponent(process.env.TWILIO_VERIFY_SERVICE_SID);
  const result = await twilioFormRequest(`/v2/Services/${serviceSid}/VerificationCheck`, {
    To: to,
    Code: cleanCode
  });
  if (result.status !== 'approved') {
    throw Object.assign(new Error('Incorrect OTP. Please check and try again.'), { statusCode: 401 });
  }
  return true;
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

function createSessionToken(mobile, purpose) {
  assertConfigured();
  const now = Math.floor(Date.now() / 1000);
  const ttlMinutes = Math.min(Math.max(Number(process.env.OTP_SESSION_TTL_MINUTES || 15), 5), 60);
  const payload = base64url(JSON.stringify({
    mobile: digits(mobile),
    purpose,
    iat: now,
    exp: now + (ttlMinutes * 60),
    nonce: crypto.randomBytes(12).toString('hex')
  }));
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token, mobile, purpose) {
  assertConfigured();
  const [payloadPart, signature] = String(token || '').split('.');
  if (!payloadPart || !signature) return false;
  const expected = sign(payloadPart);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    return payload.mobile === digits(mobile)
      && payload.purpose === purpose
      && Number(payload.exp || 0) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

module.exports = {
  configured,
  digits,
  sendOtp,
  checkOtp,
  createSessionToken,
  verifySessionToken,
  limitOtpSend,
  limitOtpVerify
};