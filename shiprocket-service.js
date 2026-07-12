const https = require('https');

let tokenCache = { token: '', expiresAt: 0 };
const HOST = 'apiv2.shiprocket.in';

function configured() {
  return Boolean(
    process.env.SHIPROCKET_EMAIL
    && process.env.SHIPROCKET_PASSWORD
    && process.env.SHIPROCKET_PICKUP_LOCATION
  );
}

function num(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function api(method, apiPath, payload, authToken) {
  const body = payload === undefined ? '' : JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: HOST,
      port: 443,
      path: apiPath,
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
      },
      timeout: 20000
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(String(
            data.message || data.error || `Shiprocket API returned HTTP ${response.statusCode}.`
          ));
          error.statusCode = response.statusCode || 502;
          return reject(error);
        }

        resolve(data);
      });
    });

    request.on('timeout', () => request.destroy(new Error('Shiprocket API request timed out.')));
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function token(force = false) {
  if (!configured()) {
    const error = new Error('Shiprocket credentials or pickup location are not configured.');
    error.code = 'SHIPROCKET_NOT_CONFIGURED';
    throw error;
  }

  if (!force && tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const result = await api('POST', '/v1/external/auth/login', {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD
  });

  if (!result.token) throw new Error('Shiprocket did not return an API token.');
  tokenCache = { token: result.token, expiresAt: Date.now() + (8 * 60 * 60 * 1000) };
  return tokenCache.token;
}

async function authed(method, apiPath, payload) {
  let authToken = await token();
  try {
    return await api(method, apiPath, payload, authToken);
  } catch (error) {
    if (error.statusCode !== 401) throw error;
    authToken = await token(true);
    return api(method, apiPath, payload, authToken);
  }
}

function splitName(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts.shift() || 'Customer', last: parts.join(' ') };
}

function orderDate(value) {
  const date = value ? new Date(value) : new Date();
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function sku(item) {
  return [item.id, item.brand, item.model]
    .filter(Boolean)
    .join('-')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .slice(0, 80);
}

async function createPrepaidOrder(order) {
  const customer = order.customer || {};
  const items = Array.isArray(order.items) ? order.items : [];

  if (!customer.city || !customer.state) {
    throw new Error('Customer city and state are required for Shiprocket.');
  }
  if (!items.length) throw new Error('Shiprocket order cannot be created without products.');

  const name = splitName(customer.name);

  return authed('POST', '/v1/external/orders/create/adhoc', {
    order_id: String(order.receipt || order.razorpayOrderId),
    order_date: orderDate(order.paidAt || order.createdAt),
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION,
    channel_id: '',
    comment: `RoyalWrap prepaid. Razorpay: ${order.paymentId || ''}`.slice(0, 200),
    billing_customer_name: name.first,
    billing_last_name: name.last,
    billing_address: String(customer.address || '').slice(0, 180),
    billing_address_2: '',
    billing_city: String(customer.city).slice(0, 80),
    billing_pincode: String(customer.pincode || ''),
    billing_state: String(customer.state).slice(0, 80),
    billing_country: 'India',
    billing_email: String(customer.email || ''),
    billing_phone: String(customer.mobile || ''),
    shipping_is_billing: true,
    order_items: items.map((item) => ({
      name: `${item.name} - ${item.brand} ${item.model}`.slice(0, 120),
      sku: sku(item),
      units: Number(item.qty || 1),
      selling_price: Number(item.unitPrice || 0),
      discount: '',
      tax: '',
      hsn: ''
    })),
    payment_method: 'Prepaid',
    shipping_charges: 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: 0,
    sub_total: Number(order.amount || 0),
    length: num('SHIPROCKET_PACKAGE_LENGTH_CM', 15),
    breadth: num('SHIPROCKET_PACKAGE_BREADTH_CM', 10),
    height: num('SHIPROCKET_PACKAGE_HEIGHT_CM', 1),
    weight: num('SHIPROCKET_PACKAGE_WEIGHT_KG', 0.25)
  });
}

async function trackByAwb(awbCode) {
  const awb = String(awbCode || '').trim();
  if (!awb) throw new Error('AWB is required for live tracking.');
  return authed('GET', `/v1/external/courier/track/awb/${encodeURIComponent(awb)}`);
}

module.exports = { createPrepaidOrder, trackByAwb, configured };
