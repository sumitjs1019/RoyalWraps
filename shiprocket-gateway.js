const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createPrepaidOrder, configured } = require('./shiprocket-service');
const { createPaymentVerifiedSessionCookie } = require('./customer-payment-session');
const {
  handleCustomerOtpSend,
  handleCustomerOtpVerify,
  handleCustomerSession,
  handleCustomerLogout,
  handleCustomerOrders
} = require('./customer-orders-service');
require('dotenv').config();

const publicPort = Number(process.env.PORT || 3000);
let ordersPort = Number(process.env.SHIPROCKET_ORDERS_GATEWAY_PORT || 3301);
const storePort = Number(process.env.ROYALWRAP_INTERNAL_PORT || 3101);
if (ordersPort === publicPort) ordersPort += 1;

const dataDir = path.join(__dirname, 'data');
const pendingFile = path.join(dataDir, 'pending-shiprocket-orders.json');
const shipmentsFile = path.join(dataDir, 'shiprocket-orders.json');
const adminKey = String(process.env.ADMIN_KEY || '');
fs.mkdirSync(dataDir, { recursive: true });

function safe(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function admin(req) {
  return adminKey.length >= 8 && safe(req.headers['x-admin-key'], adminKey);
}

function send(res, status, payload, extraHeaders = {}) {
  const responseBody = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(responseBody),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(responseBody);
}

function read(file, fallback) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

function write(file, value) {
  const temporaryFile = `${file}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(value, null, 2));
  fs.renameSync(temporaryFile, file);
}

function body(req, limit = 262144) {
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
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(buffer) {
  if (!buffer.length) return {};
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON body.'), { statusCode: 400 });
  }
}

function proxyBuffered(req, buffer) {
  return new Promise((resolve, reject) => {
    const headers = { ...req.headers, host: `127.0.0.1:${ordersPort}` };
    delete headers['transfer-encoding'];
    headers['content-length'] = Buffer.byteLength(buffer);
    const proxyRequest = http.request({
      hostname: '127.0.0.1',
      port: ordersPort,
      path: req.url,
      method: req.method,
      headers
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode || 502,
        headers: response.headers,
        body: Buffer.concat(chunks)
      }));
    });
    proxyRequest.on('error', reject);
    if (buffer.length) proxyRequest.write(buffer);
    proxyRequest.end();
  });
}

function proxy(req, res) {
  const proxyRequest = http.request({
    hostname: '127.0.0.1',
    port: ordersPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${ordersPort}` }
  }, (response) => {
    res.writeHead(response.statusCode || 502, response.headers);
    response.pipe(res);
  });
  proxyRequest.on('error', (error) => {
    if (!res.headersSent) send(res, 502, { error: `Store is unavailable: ${error.message}` });
    else res.end();
  });
  req.pipe(proxyRequest);
}

function savePending(order, request) {
  const all = read(pendingFile, {});
  all[order.orderId] = {
    razorpayOrderId: order.orderId,
    receipt: order.receipt,
    customer: request.customer || {},
    items: order.items || [],
    amount: order.displayAmount,
    currency: order.currency || 'INR',
    createdAt: new Date().toISOString()
  };
  write(pendingFile, all);
}

async function sync(orderId, paymentId) {
  const shipments = read(shipmentsFile, {});
  const existing = shipments[orderId];
  if (existing?.shiprocketOrderId || existing?.shipmentId) return existing;

  const pending = read(pendingFile, {})[orderId];
  if (!pending) throw new Error('Paid order details were not found for Shiprocket sync.');

  const now = new Date().toISOString();
  if (!configured()) {
    const record = {
      razorpayOrderId: orderId,
      receipt: pending.receipt,
      paymentId,
      syncStatus: 'not_configured',
      error: 'Add Shiprocket API credentials and pickup location in Render.',
      updatedAt: now
    };
    shipments[orderId] = record;
    write(shipmentsFile, shipments);
    return record;
  }

  try {
    const response = await createPrepaidOrder({ ...pending, paymentId, paidAt: now });
    const record = {
      razorpayOrderId: orderId,
      receipt: pending.receipt,
      paymentId,
      syncStatus: 'created',
      shiprocketOrderId: response.order_id || response.orderId || '',
      shipmentId: response.shipment_id || response.shipmentId || '',
      awbCode: response.awb_code || '',
      courierName: response.courier_name || '',
      shiprocketStatus: response.status || 'NEW',
      statusCode: response.status_code ?? null,
      response,
      updatedAt: new Date().toISOString()
    };
    shipments[orderId] = record;
    write(shipmentsFile, shipments);
    return record;
  } catch (error) {
    const record = {
      razorpayOrderId: orderId,
      receipt: pending.receipt,
      paymentId,
      syncStatus: 'failed',
      error: error.message || 'Shiprocket order creation failed.',
      updatedAt: new Date().toISOString()
    };
    shipments[orderId] = record;
    write(shipmentsFile, shipments);
    return record;
  }
}

async function createOrder(req, res) {
  const buffer = await body(req);
  const request = json(buffer);
  const result = await proxyBuffered(req, buffer);
  if (result.status >= 200 && result.status < 300) {
    try {
      const data = JSON.parse(result.body.toString('utf8'));
      if (data.orderId) savePending(data, request);
    } catch (error) {
      console.error('Shiprocket pending order save failed:', error.message);
    }
  }
  res.writeHead(result.status, result.headers);
  res.end(result.body);
}

async function verify(req, res) {
  const buffer = await body(req);
  const request = json(buffer);
  const result = await proxyBuffered(req, buffer);
  let data = {};
  try { data = JSON.parse(result.body.toString('utf8')); } catch {}
  if (result.status >= 200 && result.status < 300 && data.success) {
    const orderId = data.orderId || request.razorpay_order_id;
    const paymentId = data.paymentId || request.razorpay_payment_id;
    data.shiprocket = await sync(orderId, paymentId);

    let sessionCookie = '';
    try {
      const pending = read(pendingFile, {})[orderId] || {};
      sessionCookie = createPaymentVerifiedSessionCookie(req, pending.customer?.mobile);
      data.customerAuthenticated = Boolean(sessionCookie);
    } catch (error) {
      data.customerAuthenticated = false;
      console.error('Automatic customer login failed:', error.message);
    }

    return send(
      res,
      result.status,
      data,
      sessionCookie ? { 'Set-Cookie': sessionCookie } : {}
    );
  }
  res.writeHead(result.status, result.headers);
  res.end(result.body);
}

async function shiprocketAdmin(req, res, url) {
  if (!admin(req)) return send(res, 401, { error: 'Invalid admin key.' });
  if (req.method === 'GET' && url.pathname === '/api/admin/shiprocket/orders') {
    return send(res, 200, { shipments: Object.values(read(shipmentsFile, {})) });
  }
  const match = url.pathname.match(/^\/api\/admin\/shiprocket\/orders\/([^/]+)\/retry$/);
  if (req.method === 'POST' && match) {
    const id = decodeURIComponent(match[1]);
    const current = read(shipmentsFile, {})[id] || {};
    const shipment = await sync(id, current.paymentId || '');
    return send(res, 200, { success: shipment.syncStatus === 'created', shipment });
  }
  return send(res, 404, { error: 'Shiprocket admin route not found.' });
}

process.env.PORT = String(ordersPort);
process.env.ROYALWRAP_INTERNAL_PORT = String(storePort);
require('./orders-gateway');
process.env.PORT = String(publicPort);

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/admin/shiprocket/')) return await shiprocketAdmin(req, res, url);
    if (req.method === 'POST' && ['/api/customer/auth/send-otp', '/api/customer/otp/send'].includes(url.pathname)) return await handleCustomerOtpSend(req, res);
    if (req.method === 'POST' && ['/api/customer/auth/verify-otp', '/api/customer/otp/verify'].includes(url.pathname)) return await handleCustomerOtpVerify(req, res);
    if (req.method === 'GET' && url.pathname === '/api/customer/auth/session') return handleCustomerSession(req, res);
    if (req.method === 'POST' && url.pathname === '/api/customer/auth/logout') return handleCustomerLogout(req, res);
    if (req.method === 'POST' && url.pathname === '/api/customer/orders') return await handleCustomerOrders(req, res);
    if (req.method === 'POST' && url.pathname === '/api/create-order') return await createOrder(req, res);
    if (req.method === 'POST' && url.pathname === '/api/verify-payment') return await verify(req, res);
    return proxy(req, res);
  } catch (error) {
    return send(res, error.statusCode || 500, { error: error.message || 'Shiprocket integration failed.' });
  }
}).listen(publicPort, () => {
  console.log(`RoyalWrap Shiprocket gateway running at http://localhost:${publicPort}`);
});
