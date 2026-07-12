const https = require('https');
const fs = require('fs');
const path = require('path');
const { trackByAwb, configured: shiprocketConfigured } = require('./shiprocket-service');

const dataDir = path.join(__dirname, 'data');
const statusFile = path.join(dataDir, 'order-statuses.json');
const shipmentsFile = path.join(dataDir, 'shiprocket-orders.json');
const attempts = new Map();
let cache = { expiresAt: 0, orders: [] };

function send(res, status, payload) {
  const text = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store'
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

function rateLimit(req) {
  const now = Date.now();
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .split(',')[0].trim();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return;
  }
  entry.count += 1;
  if (entry.count > 25) {
    throw Object.assign(new Error('Too many attempts. Please try again after 15 minutes.'), { statusCode: 429 });
  }
}

function digits(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function email(value) {
  return String(value || '').trim().toLowerCase();
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
    const shipment = shipments[order.id] || {};
    const created = Number(order.created_at || payment.created_at || 0) * 1000;
    return {
      id: order.id,
      receipt: order.receipt || '',
      createdAt: created ? new Date(created).toISOString() : null,
      amountPaid: Number(order.amount_paid || order.amount || 0) / 100,
      currency: order.currency || 'INR',
      paymentStatus: payment.status || order.status || 'created',
      paymentMethod: payment.method || '',
      customer: {
        name: notes.customer_name || payment.notes?.customer_name || '',
        email: notes.customer_email || payment.email || '',
        mobile: notes.customer_mobile || payment.contact || '',
        pincode: notes.customer_pincode || ''
      },
      items: notes.items || '',
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
      mobile: digits(order.customer.mobile),
      email: order.customer.email,
      pincode: order.customer.pincode
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

async function handleCustomerOrders(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
    rateLimit(req);
    const input = await readBody(req);
    const mode = String(input.mode || 'track').toLowerCase();
    const mobile = digits(input.mobile);
    if (!/^\d{10}$/.test(mobile)) {
      return send(res, 400, { error: 'Enter the same 10-digit mobile number used during checkout.' });
    }

    const orders = await loadOrders(true);
    let matches = [];
    if (mode === 'list') {
      const customerEmail = email(input.email);
      if (!/^\S+@\S+\.\S+$/.test(customerEmail)) {
        return send(res, 400, { error: 'Enter the same email used during checkout.' });
      }
      matches = orders.filter((order) => (
        digits(order.customer.mobile) === mobile && email(order.customer.email) === customerEmail
      ));
    } else {
      const orderId = String(input.orderId || '').trim();
      if (orderId.length < 6 || orderId.length > 80) {
        return send(res, 400, { error: 'Enter a valid Order ID.' });
      }
      matches = orders.filter((order) => (
        digits(order.customer.mobile) === mobile && (order.id === orderId || order.receipt === orderId)
      ));
    }

    const result = matches.map(publicOrder);
    if (mode === 'track' && result.length === 1 && result[0].shipment.awbCode && shiprocketConfigured()) {
      try {
        result[0].liveTracking = summarizeTracking(await trackByAwb(result[0].shipment.awbCode));
      } catch {
        result[0].liveTracking = null;
      }
    }

    return send(res, 200, { orders: result, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return send(res, error.statusCode || 500, { error: error.message || 'Could not load orders.' });
  }
}

module.exports = { handleCustomerOrders };
