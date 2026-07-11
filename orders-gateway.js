const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const publicPort = Number(process.env.PORT || 3000);
let internalPort = Number(process.env.ROYALWRAP_INTERNAL_PORT || 3101);
if (internalPort === publicPort) internalPort += 1;

const dataDir = path.join(__dirname, 'data');
const statusFile = path.join(dataDir, 'order-statuses.json');
const allowedStatuses = new Set(['New', 'Processing', 'Printed', 'Shipped', 'Delivered', 'Cancelled']);
const adminKey = String(process.env.ADMIN_KEY || '');

fs.mkdirSync(dataDir, { recursive: true });

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isAdmin(req) {
  return adminKey.length >= 8 && safeCompare(req.headers['x-admin-key'], adminKey);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJsonBody(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > limit) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function readStatuses() {
  try {
    if (!fs.existsSync(statusFile)) return {};
    const parsed = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeStatuses(statuses) {
  const temporaryFile = `${statusFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(statuses, null, 2));
  fs.renameSync(temporaryFile, statusFile);
}

function razorpayRequest(apiPath) {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '');
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '');

  if (!keyId || !keySecret || keyId.includes('your_key') || keySecret.includes('your_key')) {
    return Promise.reject(Object.assign(new Error('Razorpay is not configured on the server.'), { statusCode: 503 }));
  }

  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'api.razorpay.com',
      port: 443,
      path: apiPath,
      method: 'GET',
      headers: {
        Authorization: `Basic ${authorization}`,
        Accept: 'application/json'
      },
      timeout: 15000
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        let parsed = {};
        try { parsed = body ? JSON.parse(body) : {}; } catch { parsed = {}; }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          const message = parsed?.error?.description || parsed?.error?.reason || 'Could not load Razorpay orders.';
          return reject(Object.assign(new Error(message), { statusCode: response.statusCode || 502 }));
        }

        resolve(parsed);
      });
    });

    request.on('timeout', () => request.destroy(new Error('Razorpay request timed out.')));
    request.on('error', reject);
    request.end();
  });
}

let ordersCache = { expiresAt: 0, items: [] };

async function loadOrders(forceRefresh = false) {
  if (!forceRefresh && Date.now() < ordersCache.expiresAt) return ordersCache.items;

  const [orderData, paymentData] = await Promise.all([
    razorpayRequest('/v1/orders?count=100'),
    razorpayRequest('/v1/payments?count=100')
  ]);

  const statuses = readStatuses();
  const paymentByOrder = new Map();

  for (const payment of paymentData.items || []) {
    if (!payment.order_id) continue;
    const existing = paymentByOrder.get(payment.order_id);
    if (!existing || Number(payment.created_at || 0) > Number(existing.created_at || 0)) {
      paymentByOrder.set(payment.order_id, payment);
    }
  }

  const items = (orderData.items || []).map((order) => {
    const payment = paymentByOrder.get(order.id) || null;
    const notes = order.notes || {};
    const createdAt = Number(order.created_at || payment?.created_at || 0) * 1000;

    return {
      id: order.id,
      receipt: order.receipt || '',
      createdAt: createdAt ? new Date(createdAt).toISOString() : null,
      amount: Number(order.amount || 0) / 100,
      amountPaid: Number(order.amount_paid || 0) / 100,
      currency: order.currency || 'INR',
      paymentStatus: payment?.status || order.status || 'created',
      paymentId: payment?.id || '',
      paymentMethod: payment?.method || '',
      customer: {
        name: notes.customer_name || payment?.notes?.customer_name || '',
        email: notes.customer_email || payment?.email || '',
        mobile: notes.customer_mobile || payment?.contact || '',
        pincode: notes.customer_pincode || '',
        address: notes.customer_address || ''
      },
      items: notes.items || '',
      fulfillmentStatus: statuses[order.id]?.status || 'New',
      statusUpdatedAt: statuses[order.id]?.updatedAt || null
    };
  }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  ordersCache = { expiresAt: Date.now() + 30000, items };
  return items;
}

async function handleAdminRequest(req, res, url) {
  if (!adminKey || adminKey.length < 8) {
    return sendJson(res, 503, { error: 'ADMIN_KEY is not configured. Add it in Render environment variables.' });
  }

  if (!isAdmin(req)) return sendJson(res, 401, { error: 'Invalid admin key.' });

  if (req.method === 'GET' && url.pathname === '/api/admin/orders') {
    const forceRefresh = url.searchParams.get('refresh') === '1';
    const orders = await loadOrders(forceRefresh);
    return sendJson(res, 200, { orders, fetchedAt: new Date().toISOString() });
  }

  const statusMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
  if (req.method === 'POST' && statusMatch) {
    const orderId = decodeURIComponent(statusMatch[1]);
    const body = await readJsonBody(req);
    const status = String(body.status || '').trim();

    if (!allowedStatuses.has(status)) {
      return sendJson(res, 400, { error: 'Invalid fulfillment status.' });
    }

    const statuses = readStatuses();
    statuses[orderId] = { status, updatedAt: new Date().toISOString() };
    writeStatuses(statuses);
    ordersCache.expiresAt = 0;
    return sendJson(res, 200, { success: true, orderId, status, updatedAt: statuses[orderId].updatedAt });
  }

  return sendJson(res, 404, { error: 'Admin API route not found.' });
}

function proxyToStore(req, res) {
  const proxyHeaders = { ...req.headers, host: `127.0.0.1:${internalPort}` };
  delete proxyHeaders['content-length'];

  const proxyRequest = http.request({
    hostname: '127.0.0.1',
    port: internalPort,
    path: req.url,
    method: req.method,
    headers: proxyHeaders
  }, (proxyResponse) => {
    res.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
    proxyResponse.pipe(res);
  });

  proxyRequest.on('error', (error) => {
    if (!res.headersSent) {
      sendJson(res, 502, { error: `Store service is unavailable: ${error.message}` });
    } else {
      res.end();
    }
  });

  req.pipe(proxyRequest);
}

process.env.PORT = String(internalPort);
require('./server');
process.env.PORT = String(publicPort);

const gateway = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/admin/')) {
      return await handleAdminRequest(req, res, url);
    }
    return proxyToStore(req, res);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message || 'Orders dashboard request failed.' });
  }
});

gateway.listen(publicPort, () => {
  console.log(`RoyalWrap Orders gateway running at http://localhost:${publicPort}`);
});
