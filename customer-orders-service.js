const https = require('https');
const fs = require('fs');
const path = require('path');
const { trackByAwb, configured: shiprocketConfigured } = require('./shiprocket-service');
const {
  configured: otpConfigured,
  digits,
  sendOtp,
  checkOtp,
  createSessionToken,
  readSessionToken,
  sessionTtlSeconds,
  limitOtpSend,
  limitOtpVerify
} = require('./otp-service');

const dataDir = path.join(__dirname, 'data');
const statusFile = path.join(dataDir, 'order-statuses.json');
const shipmentsFile = path.join(dataDir, 'shiprocket-orders.json');
const SESSION_COOKIE = 'rw_customer_session';
const accessAttempts = new Map();
let cache = { expiresAt: 0, orders: [] };

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

function read(file, fallback) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
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

function requestIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function limitOrderAccess(req) {
  const now = Date.now();
  const key = requestIp(req);
  const entry = accessAttempts.get(key);
  if (!entry || now >= entry.resetAt) {
    accessAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return;
  }
  entry.count += 1;
  if (entry.count > 80) {
    throw Object.assign(new Error('Too many requests. Please try again after 15 minutes.'), { statusCode: 429 });
  }
}

function validMode(value) {
  const mode = String(value || '').toLowerCase();
  if (!['list', 'track'].includes(mode)) {
    throw Object.assign(new Error('Invalid order access type.'), { statusCode: 400 });
  }
  return mode;
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

function clearCookie(req) {
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    isSecureRequest(req) ? 'Secure' : ''
  ].filter(Boolean).join('; ');
}

function sessionFromRequest(req) {
  if (!otpConfigured()) return null;
  const token = parseCookies(req)[SESSION_COOKIE];
  return token ? readSessionToken(token) : null;
}

function maskedMobile(mobile) {
  const clean = digits(mobile);
  return clean ? `+91 ${clean.slice(0, 2)}******${clean.slice(-2)}` : '';
}

function razorpayRequest(apiPath) {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '');
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '');
  if (!keyId || !keySecret) {
    return Promise.reject(Object.assign(new Error('Order lookup is not configured.'), { statusCode: 503 }));
  }
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'api.razorpay.com',
      port: 443,
      path: apiPath,
      method: 'GET',
      headers: { Authorization: `Basic ${authorization}`, Accept: 'application/json' },
      timeout: 15000
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch {}
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(Object.assign(new Error('Could not load order details.'), { statusCode: 502 }));
        }
        resolve(data);
      });
    });
    request.on('timeout', () => request.destroy(new Error('Order lookup timed out.')));
    request.on('error', reject);
    request.end();
  });
}

function cleanAddress(value, pincode) {
  let address = String(value || '').trim();
  if (!address) return '';
  const cleanPin = String(pincode || '').replace(/\D/g, '');
  if (cleanPin) {
    address = address.replace(new RegExp(`,?\\s*PIN\\s*:?\\s*${cleanPin}\\s*$`, 'i'), '');
  }
  return address.replace(/,\s*$/, '').trim();
}

async function loadOrders(force = false) {
  if (!force && Date.now() < cache.expiresAt) return cache.orders;
  const [orderData, paymentData] = await Promise.all([
    razorpayRequest('/v1/orders?count=100'),
    razorpayRequest('/v1/payments?count=100')
  ]);
  const statuses = read(statusFile, {});
  const shipments = read(shipmentsFile, {});
  const payments = new Map();

  for (const payment of paymentData.items || []) {
    if (!payment.order_id) continue;
    const current = payments.get(payment.order_id);
    if (!current || Number(payment.created_at || 0) > Number(current.created_at || 0)) {
      payments.set(payment.order_id, payment);
    }
  }

  cache.orders = (orderData.items || []).map((order) => {
    const payment = payments.get(order.id) || {};
    const notes = order.notes || {};
    const paymentNotes = payment.notes || {};
    const shipment = shipments[order.id] || {};
    const created = Number(order.created_at || payment.created_at || 0) * 1000;
    const pincode = notes.customer_pincode || paymentNotes.customer_pincode || '';
    const address = cleanAddress(notes.customer_address || paymentNotes.customer_address || '', pincode);

    return {
      id: order.id,
      receipt: order.receipt || '',
      createdAt: created ? new Date(created).toISOString() : null,
      amountPaid: Number(order.amount_paid || order.amount || 0) / 100,
      currency: order.currency || 'INR',
      paymentStatus: payment.status || order.status || 'created',
      paymentMethod: payment.method || '',
      customer: {
        name: notes.customer_name || paymentNotes.customer_name || '',
        email: notes.customer_email || payment.email || '',
        mobile: notes.customer_mobile || payment.contact || '',
        pincode,
        address
      },
      items: notes.items || paymentNotes.items || '',
      fulfillmentStatus: statuses[order.id]?.status || 'New',
      statusUpdatedAt: statuses[order.id]?.updatedAt || null,
      shipment: {
        syncStatus: shipment.syncStatus || 'pending',
        shiprocketOrderId: shipment.shiprocketOrderId || '',
        shipmentId: shipment.shipmentId || '',
        awbCode: shipment.awbCode || '',
        courierName: shipment.courierName || '',
        shiprocketStatus: shipment.shiprocketStatus || '',
        updatedAt: shipment.updatedAt || ''
      }
    };
  }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  cache.expiresAt = Date.now() + 30000;
  return cache.orders;
}

function ordersForMobile(orders, mobile) {
  return orders.filter((order) => digits(order.customer.mobile) === mobile);
}

function isConfirmedOrder(order) {
  return ['captured', 'paid'].includes(String(order.paymentStatus || '').toLowerCase());
}

function publicOrder(order) {
  return {
    id: order.id,
    receipt: order.receipt,
    createdAt: order.createdAt,
    amountPaid: order.amountPaid,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    customer: {
      name: order.customer.name,
      pincode: order.customer.pincode,
      address: order.customer.address
    },
    items: order.items,
    fulfillmentStatus: order.fulfillmentStatus,
    statusUpdatedAt: order.statusUpdatedAt,
    shipment: order.shipment
  };
}

function summarizeTracking(data) {
  const root = data?.tracking_data || data?.data || data || {};
  const track = Array.isArray(root.shipment_track) ? root.shipment_track[0] || {} : {};
  const activities = Array.isArray(root.shipment_track_activities)
    ? root.shipment_track_activities.slice(0, 15).map((item) => ({
        date: item.date || item.datetime || '',
        status: item['sr-status-label'] || item.status || '',
        activity: item.activity || item.message || '',
        location: item.location || ''
      }))
    : [];
  return {
    currentStatus: track.current_status || root.track_status || '',
    estimatedDelivery: track.edd || root.etd || '',
    activities
  };
}

async function handleCustomerOtpSend(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
    if (!otpConfigured()) return send(res, 503, { error: 'Mobile OTP is not configured on the server.' });
    const input = await readBody(req);
    const mobile = validMobile(input.mobile);
    limitOtpSend(req, mobile);
    const orders = await loadOrders(true);
    if (!ordersForMobile(orders, mobile).length) {
      return send(res, 404, { error: 'No RoyalWrap order was found for this mobile number.' });
    }
    await sendOtp(mobile);
    return send(res, 200, { success: true, message: 'OTP sent to your mobile number.' });
  } catch (error) {
    console.error('Customer OTP send failed:', error.providerMessage || error.message);
    return send(res, error.statusCode || 500, { error: error.message || 'Could not send OTP.' });
  }
}

async function handleCustomerOtpVerify(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
    if (!otpConfigured()) return send(res, 503, { error: 'Mobile OTP is not configured on the server.' });
    const input = await readBody(req);
    const mobile = validMobile(input.mobile);
    limitOtpVerify(req, mobile);
    const orders = await loadOrders(true);
    if (!ordersForMobile(orders, mobile).length) {
      return send(res, 404, { error: 'No RoyalWrap order was found for this mobile number.' });
    }
    await checkOtp(mobile, input.code);
    const token = createSessionToken(mobile);
    return send(res, 200, {
      success: true,
      mobile: maskedMobile(mobile),
      expiresInDays: Math.round(sessionTtlSeconds() / 86400)
    }, { 'Set-Cookie': createCookie(req, token) });
  } catch (error) {
    console.error('Customer OTP verification failed:', error.providerMessage || error.message);
    return send(res, error.statusCode || 500, { error: error.message || 'Could not verify OTP.' });
  }
}

function handleCustomerSession(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });
    const session = sessionFromRequest(req);
    if (!session) return send(res, 200, { authenticated: false });
    return send(res, 200, {
      authenticated: true,
      mobile: maskedMobile(session.mobile),
      expiresAt: new Date(Number(session.exp) * 1000).toISOString()
    });
  } catch (error) {
    return send(res, error.statusCode || 500, { error: error.message || 'Could not check login.' });
  }
}

function handleCustomerLogout(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
  return send(res, 200, { success: true }, { 'Set-Cookie': clearCookie(req) });
}

async function handleCustomerOrders(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
    limitOrderAccess(req);
    const session = sessionFromRequest(req);
    if (!session) return send(res, 401, { error: 'Please log in with your mobile number and OTP.' });

    const input = await readBody(req);
    const mode = validMode(input.mode);
    const orders = await loadOrders(true);
    const matches = ordersForMobile(orders, session.mobile)
      .filter(isConfirmedOrder)
      .slice(0, 20);
    const result = matches.map(publicOrder);

    if (mode === 'track' && shiprocketConfigured()) {
      await Promise.all(result.map(async (order) => {
        if (!order.shipment.awbCode) return;
        try {
          order.liveTracking = summarizeTracking(await trackByAwb(order.shipment.awbCode));
        } catch {
          order.liveTracking = null;
        }
      }));
    }

    return send(res, 200, {
      orders: result,
      mobile: maskedMobile(session.mobile),
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return send(res, error.statusCode || 500, { error: error.message || 'Could not load orders.' });
  }
}

module.exports = {
  handleCustomerOtpSend,
  handleCustomerOtpVerify,
  handleCustomerSession,
  handleCustomerLogout,
  handleCustomerOrders
};
