const PRODUCT_CATALOG = {
  'custom-mobile-skin': { name: 'Custom Photo Mobile Skin', price: 399 },
  'ayodhya-mandir': { name: 'Ayodhya Mandir Heritage Skin', price: 399 },
  'lotus-jaali': { name: 'Lotus Jaali Palace Skin', price: 399 },
  'cosmic-galaxy': { name: 'Cosmic Galaxy Vortex Skin', price: 399 },
  'obsidian-diamond': { name: 'Obsidian Diamond Armor Skin', price: 399 },
  'honeycomb-pro': { name: 'Honeycomb Copper Pro Skin', price: 399 },
  'peacock-krishna': { name: 'Peacock Jewel Krishna Skin', price: 399 },
  'luxury-leather': { name: 'Luxury Quilted Leather Skin', price: 399 },
  'emerald-marble': { name: 'Emerald Marble Gold Skin', price: 399 },
  'sapphire-marble': { name: 'Sapphire Marble Gold Skin', price: 399 },
  'royal-midnight': { name: 'Royal Midnight Palace Skin', price: 399 },
  'bhagwan-ram': { name: 'Bhagwan Ram Skin', price: 399 }
};

const SESSION_COOKIE = 'rw_customer_session';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function json(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

function cleanDigits(value, max = 10) {
  return String(value || '').replace(/\D/g, '').slice(-max);
}

function validMobile(value) {
  const mobile = cleanDigits(value, 10);
  if (!/^[6-9]\d{9}$/.test(mobile)) throw httpError(400, 'Enter a valid 10-digit Indian mobile number.');
  return mobile;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function readJson(request, limit = 128 * 1024) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > limit) throw httpError(413, 'Request body is too large.');
  try {
    return await request.json();
  } catch {
    throw httpError(400, 'Invalid JSON request.');
  }
}

function assertDb(env) {
  if (!env.DB) throw httpError(503, 'D1 database is not connected. Add a D1 binding named DB.');
}

function assertRazorpay(env) {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw httpError(503, 'Razorpay is not configured in Cloudflare Variables and Secrets.');
  }
}

function toBase64(value) {
  const bytes = encoder.encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(value) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value).length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return decoder.decode(bytes);
}

async function hmacBytes(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', key, encoder.encode(value));
}

async function hmacHex(secret, value) {
  return bytesToHex(await hmacBytes(secret, value));
}

function constantTimeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function sessionTtlSeconds(env) {
  const days = Math.min(Math.max(Number(env.CUSTOMER_SESSION_TTL_DAYS || 7), 1), 30);
  return Math.round(days * 24 * 60 * 60);
}

async function createSessionToken(env, mobile) {
  if (!env.CUSTOMER_OTP_SESSION_SECRET) throw httpError(503, 'Customer session secret is not configured.');
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(JSON.stringify({
    mobile,
    purpose: 'customer',
    iat: now,
    exp: now + sessionTtlSeconds(env),
    nonce: crypto.randomUUID()
  }));
  const signature = base64UrlEncode(new Uint8Array(await hmacBytes(env.CUSTOMER_OTP_SESSION_SECRET, payload)));
  return `${payload}.${signature}`;
}

async function readSessionToken(env, token) {
  if (!env.CUSTOMER_OTP_SESSION_SECRET) return null;
  const [payloadPart, signature] = String(token || '').split('.');
  if (!payloadPart || !signature) return null;
  const expected = base64UrlEncode(new Uint8Array(await hmacBytes(env.CUSTOMER_OTP_SESSION_SECRET, payloadPart)));
  if (!constantTimeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart));
    if (payload.purpose !== 'customer') return null;
    if (!/^[6-9]\d{9}$/.test(String(payload.mobile || ''))) return null;
    if (Number(payload.exp || 0) <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(request) {
  const result = {};
  for (const part of String(request.headers.get('cookie') || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { result[key] = decodeURIComponent(value); } catch { result[key] = value; }
  }
  return result;
}

async function sessionFromRequest(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  return token ? readSessionToken(env, token) : null;
}

function sessionCookie(env, token) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${sessionTtlSeconds(env)}`
  ].join('; ');
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function cleanAddress(value, pincode) {
  let address = String(value || '').trim();
  const pin = cleanDigits(pincode, 6);
  if (pin) address = address.replace(new RegExp(`,?\\s*PIN\\s*:?\\s*${pin}\\s*$`, 'i'), '');
  return address.replace(/,\s*$/, '').trim();
}

function validateCustomer(customer = {}) {
  const name = String(customer.name || '').trim();
  const email = String(customer.email || '').trim();
  const mobile = cleanDigits(customer.mobile, 10);
  const pincode = cleanDigits(customer.pincode, 6);
  const address = String(customer.address || '').trim();
  if (name.length < 2 || name.length > 100) throw httpError(400, 'Please enter customer name.');
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 160) throw httpError(400, 'Please enter a valid email address.');
  if (!/^[6-9]\d{9}$/.test(mobile)) throw httpError(400, 'Please enter exactly 10 digits in mobile number.');
  if (!/^\d{6}$/.test(pincode)) throw httpError(400, 'Please enter exactly 6 digits in pin code.');
  if (address.length < 10 || address.length > 240) throw httpError(400, 'Please enter complete delivery address.');
  return { name, email, mobile, pincode, address };
}

function normalizeCart(items) {
  if (!Array.isArray(items) || !items.length) throw httpError(400, 'Cart is empty.');
  const grouped = new Map();
  for (const raw of items) {
    const id = String(raw?.id || '').trim();
    const product = PRODUCT_CATALOG[id];
    if (!product) throw httpError(400, `Invalid product: ${id || 'unknown'}`);
    const brand = String(raw?.brand || '').trim().slice(0, 50);
    const model = String(raw?.model || '').trim().slice(0, 70);
    const qty = Number.parseInt(raw?.qty, 10);
    if (!brand || !model) throw httpError(400, 'Please select mobile brand and model for every product.');
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw httpError(400, 'Quantity must be between 1 and 10.');
    const key = `${id}__${brand}__${model}`;
    const current = grouped.get(key) || { id, name: product.name, brand, model, qty: 0, unitPrice: product.price };
    current.qty += qty;
    if (current.qty > 10) throw httpError(400, 'Maximum 10 quantity allowed per product and model.');
    grouped.set(key, current);
  }
  const cleanItems = Array.from(grouped.values()).map((item) => ({
    ...item,
    lineTotal: item.unitPrice * item.qty
  }));
  const amount = cleanItems.reduce((sum, item) => sum + item.lineTotal, 0);
  return { cleanItems, amount };
}

async function razorpayFetch(env, path, options = {}) {
  assertRazorpay(env);
  const response = await fetch(`https://api.razorpay.com${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${toBase64(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.description || data?.error?.reason || 'Razorpay request failed.';
    throw httpError(response.status >= 400 && response.status < 500 ? 400 : 502, message);
  }
  return data;
}

async function insertOrder(env, record) {
  assertDb(env);
  await env.DB.prepare(`
    INSERT INTO orders (
      razorpay_order_id, receipt, created_at, amount_paid, currency,
      payment_status, payment_method, payment_id,
      customer_name, customer_email, customer_mobile, customer_pincode, customer_address,
      items_text, items_json, fulfillment_status, status_updated_at, paid_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(razorpay_order_id) DO UPDATE SET
      receipt = excluded.receipt,
      created_at = excluded.created_at,
      amount_paid = excluded.amount_paid,
      currency = excluded.currency,
      payment_status = excluded.payment_status,
      payment_method = excluded.payment_method,
      payment_id = excluded.payment_id,
      customer_name = excluded.customer_name,
      customer_email = excluded.customer_email,
      customer_mobile = excluded.customer_mobile,
      customer_pincode = excluded.customer_pincode,
      customer_address = excluded.customer_address,
      items_text = excluded.items_text,
      items_json = excluded.items_json,
      fulfillment_status = COALESCE(orders.fulfillment_status, excluded.fulfillment_status),
      status_updated_at = COALESCE(excluded.status_updated_at, orders.status_updated_at),
      paid_at = COALESCE(excluded.paid_at, orders.paid_at)
  `).bind(
    record.razorpayOrderId,
    record.receipt || '',
    record.createdAt || new Date().toISOString(),
    Number(record.amountPaid || 0),
    record.currency || 'INR',
    record.paymentStatus || 'created',
    record.paymentMethod || '',
    record.paymentId || '',
    record.customerName || '',
    record.customerEmail || '',
    record.customerMobile || '',
    record.customerPincode || '',
    record.customerAddress || '',
    record.itemsText || '',
    record.itemsJson || '[]',
    record.fulfillmentStatus || 'New',
    record.statusUpdatedAt || null,
    record.paidAt || null
  ).run();
}

async function syncRecentRazorpayOrders(env, mobile) {
  assertDb(env);
  assertRazorpay(env);
  const [ordersData, paymentsData] = await Promise.all([
    razorpayFetch(env, '/v1/orders?count=100'),
    razorpayFetch(env, '/v1/payments?count=100')
  ]);
  const paymentByOrder = new Map();
  for (const payment of paymentsData.items || []) {
    if (!payment.order_id) continue;
    const existing = paymentByOrder.get(payment.order_id);
    if (!existing || Number(payment.created_at || 0) > Number(existing.created_at || 0)) paymentByOrder.set(payment.order_id, payment);
  }
  let imported = 0;
  for (const order of ordersData.items || []) {
    const payment = paymentByOrder.get(order.id) || {};
    const notes = order.notes || {};
    const paymentNotes = payment.notes || {};
    const orderMobile = cleanDigits(notes.customer_mobile || paymentNotes.customer_mobile || payment.contact, 10);
    if (orderMobile !== mobile) continue;
    const status = String(payment.status || order.status || 'created').toLowerCase();
    if (!['captured', 'paid', 'authorized'].includes(status)) continue;
    const createdMs = Number(order.created_at || payment.created_at || 0) * 1000;
    const pincode = String(notes.customer_pincode || paymentNotes.customer_pincode || '');
    await insertOrder(env, {
      razorpayOrderId: order.id,
      receipt: order.receipt || '',
      createdAt: createdMs ? new Date(createdMs).toISOString() : new Date().toISOString(),
      amountPaid: Number(order.amount_paid || order.amount || payment.amount || 0) / 100,
      currency: order.currency || payment.currency || 'INR',
      paymentStatus: status === 'authorized' ? 'paid' : status,
      paymentMethod: payment.method || '',
      paymentId: payment.id || '',
      customerName: notes.customer_name || paymentNotes.customer_name || '',
      customerEmail: notes.customer_email || payment.email || '',
      customerMobile: orderMobile,
      customerPincode: pincode,
      customerAddress: cleanAddress(notes.customer_address || paymentNotes.customer_address || '', pincode),
      itemsText: notes.items || paymentNotes.items || '',
      itemsJson: '[]',
      fulfillmentStatus: 'New',
      paidAt: payment.created_at ? new Date(Number(payment.created_at) * 1000).toISOString() : null
    });
    imported += 1;
  }
  return imported;
}

async function countOrdersForMobile(env, mobile) {
  assertDb(env);
  const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM orders WHERE customer_mobile = ?`).bind(mobile).first();
  return Number(row?.count || 0);
}

async function handleCreateOrder(request, env) {
  assertDb(env);
  const input = await readJson(request);
  const { cleanItems, amount } = normalizeCart(input.items);
  const customer = validateCustomer(input.customer);
  const receipt = `rw_${Date.now()}`;
  const itemsText = cleanItems.map((item) => `${item.name} (${item.model}) x ${item.qty}`).join(', ').slice(0, 250);
  const razorpayOrder = await razorpayFetch(env, '/v1/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount: amount * 100,
      currency: 'INR',
      receipt,
      notes: {
        customer_name: customer.name.slice(0, 250),
        customer_email: customer.email.slice(0, 250),
        customer_mobile: customer.mobile,
        customer_pincode: customer.pincode,
        customer_address: `${customer.address}, PIN: ${customer.pincode}`.slice(0, 250),
        items: itemsText
      }
    })
  });
  await insertOrder(env, {
    razorpayOrderId: razorpayOrder.id,
    receipt,
    createdAt: new Date().toISOString(),
    amountPaid: amount,
    currency: razorpayOrder.currency || 'INR',
    paymentStatus: 'created',
    customerName: customer.name,
    customerEmail: customer.email,
    customerMobile: customer.mobile,
    customerPincode: customer.pincode,
    customerAddress: customer.address,
    itemsText,
    itemsJson: JSON.stringify(cleanItems),
    fulfillmentStatus: 'New'
  });
  return json(200, {
    orderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    displayAmount: amount,
    currency: razorpayOrder.currency || 'INR',
    receipt,
    items: cleanItems,
    customer
  });
}

async function handleVerifyPayment(request, env) {
  assertDb(env);
  assertRazorpay(env);
  const input = await readJson(request);
  const orderId = String(input.razorpay_order_id || '').trim();
  const paymentId = String(input.razorpay_payment_id || '').trim();
  const signature = String(input.razorpay_signature || '').trim();
  if (!orderId || !paymentId || !signature) throw httpError(400, 'Payment verification fields are missing.');
  const expected = await hmacHex(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
  if (!constantTimeEqual(signature, expected)) throw httpError(400, 'Invalid payment signature.');
  const payment = await razorpayFetch(env, `/v1/payments/${encodeURIComponent(paymentId)}`);
  if (String(payment.order_id || '') !== orderId) throw httpError(400, 'Payment does not belong to this order.');
  const stored = await env.DB.prepare(`SELECT * FROM orders WHERE razorpay_order_id = ?`).bind(orderId).first();
  if (!stored) throw httpError(404, 'Order details were not found.');
  if (Number(payment.amount || 0) !== Math.round(Number(stored.amount_paid || 0) * 100)) {
    throw httpError(400, 'Payment amount does not match the order total.');
  }
  const providerStatus = String(payment.status || '').toLowerCase();
  if (!['captured', 'authorized'].includes(providerStatus)) throw httpError(400, `Payment is ${providerStatus || 'not completed'}.`);
  const publicStatus = providerStatus === 'authorized' ? 'paid' : 'captured';
  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE orders
    SET payment_status = ?, payment_method = ?, payment_id = ?, paid_at = ?, status_updated_at = ?
    WHERE razorpay_order_id = ?
  `).bind(publicStatus, payment.method || '', paymentId, now, now, orderId).run();
  const mobile = validMobile(stored.customer_mobile);
  const token = await createSessionToken(env, mobile);
  return json(200, {
    success: true,
    message: 'Payment verified successfully.',
    paymentId,
    orderId,
    customerAuthenticated: true
  }, { 'Set-Cookie': sessionCookie(env, token) });
}

async function twoFactorRequest(env, path) {
  if (!env.TWOFACTOR_API_KEY) throw httpError(503, 'Mobile OTP is not configured in Cloudflare.');
  const response = await fetch(`https://2factor.in${path}`, { headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  const status = String(data.Status || data.status || '').toLowerCase();
  if (!response.ok || status !== 'success') {
    const message = String(data.Details || data.details || data.Message || data.message || 'OTP service could not complete the request.');
    throw httpError(response.status === 429 ? 429 : 502, message);
  }
  return data;
}

async function handleOtpSend(request, env) {
  assertDb(env);
  const input = await readJson(request);
  const mobile = validMobile(input.mobile);
  let count = await countOrdersForMobile(env, mobile);
  if (!count && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    await syncRecentRazorpayOrders(env, mobile);
    count = await countOrdersForMobile(env, mobile);
  }
  if (!count) throw httpError(404, 'No RoyalWrap order was found for this mobile number.');
  const existing = await env.DB.prepare(`SELECT sent_at FROM otp_sessions WHERE mobile = ?`).bind(mobile).first();
  const now = Date.now();
  if (existing?.sent_at && now - Number(existing.sent_at) < 60_000) {
    const wait = Math.ceil((60_000 - (now - Number(existing.sent_at))) / 1000);
    throw httpError(429, `Please wait ${wait} seconds before requesting another OTP.`);
  }
  const apiKey = encodeURIComponent(String(env.TWOFACTOR_API_KEY || '').trim());
  const result = await twoFactorRequest(env, `/API/V1/${apiKey}/SMS/${encodeURIComponent(mobile)}/AUTOGEN`);
  const providerSessionId = String(result.Details || result.details || '').trim();
  if (!providerSessionId) throw httpError(502, 'OTP service did not return a verification session.');
  await env.DB.prepare(`
    INSERT INTO otp_sessions (mobile, provider_session_id, expires_at, sent_at, verify_attempts)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(mobile) DO UPDATE SET
      provider_session_id = excluded.provider_session_id,
      expires_at = excluded.expires_at,
      sent_at = excluded.sent_at,
      verify_attempts = 0
  `).bind(mobile, providerSessionId, now + 10 * 60_000, now).run();
  return json(200, { success: true, message: 'OTP sent to your mobile number.' });
}

async function handleOtpVerify(request, env) {
  assertDb(env);
  const input = await readJson(request);
  const mobile = validMobile(input.mobile);
  const code = cleanDigits(input.code, 10);
  if (!/^\d{4,10}$/.test(code)) throw httpError(400, 'Enter the OTP sent to your mobile number.');
  const otp = await env.DB.prepare(`SELECT * FROM otp_sessions WHERE mobile = ?`).bind(mobile).first();
  if (!otp || Number(otp.expires_at || 0) <= Date.now()) {
    await env.DB.prepare(`DELETE FROM otp_sessions WHERE mobile = ?`).bind(mobile).run();
    throw httpError(401, 'OTP expired. Please request a new OTP.');
  }
  if (Number(otp.verify_attempts || 0) >= 10) throw httpError(429, 'Too many OTP attempts. Please request a new OTP.');
  await env.DB.prepare(`UPDATE otp_sessions SET verify_attempts = verify_attempts + 1 WHERE mobile = ?`).bind(mobile).run();
  const apiKey = encodeURIComponent(String(env.TWOFACTOR_API_KEY || '').trim());
  try {
    await twoFactorRequest(env, `/API/V1/${apiKey}/SMS/VERIFY/${encodeURIComponent(otp.provider_session_id)}/${encodeURIComponent(code)}`);
  } catch (error) {
    const text = String(error.message || '').toLowerCase();
    throw httpError(401, text.includes('expired') ? 'OTP expired. Please request a new OTP.' : 'Incorrect OTP. Please check and try again.');
  }
  await env.DB.prepare(`DELETE FROM otp_sessions WHERE mobile = ?`).bind(mobile).run();
  const token = await createSessionToken(env, mobile);
  return json(200, {
    success: true,
    mobile: `+91 ${mobile.slice(0, 2)}******${mobile.slice(-2)}`,
    expiresInDays: Math.round(sessionTtlSeconds(env) / 86400)
  }, { 'Set-Cookie': sessionCookie(env, token) });
}

async function handleSession(request, env) {
  const session = await sessionFromRequest(request, env);
  return json(200, session
    ? { authenticated: true, mobile: `+91 ${session.mobile.slice(0, 2)}******${session.mobile.slice(-2)}` }
    : { authenticated: false });
}

async function handleOrders(request, env) {
  assertDb(env);
  const session = await sessionFromRequest(request, env);
  if (!session) return json(401, { error: 'Login required.' });
  const input = await readJson(request).catch(() => ({}));
  const mode = String(input.mode || 'list').toLowerCase();
  if (!['list', 'track'].includes(mode)) throw httpError(400, 'Invalid order access type.');
  let result = await env.DB.prepare(`
    SELECT * FROM orders
    WHERE customer_mobile = ? AND payment_status IN ('captured', 'paid')
    ORDER BY datetime(created_at) DESC
    LIMIT 100
  `).bind(session.mobile).all();
  if (!(result.results || []).length && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    await syncRecentRazorpayOrders(env, session.mobile);
    result = await env.DB.prepare(`
      SELECT * FROM orders
      WHERE customer_mobile = ? AND payment_status IN ('captured', 'paid')
      ORDER BY datetime(created_at) DESC
      LIMIT 100
    `).bind(session.mobile).all();
  }
  const orders = (result.results || []).map((row) => ({
    id: row.razorpay_order_id,
    receipt: row.receipt || '',
    createdAt: row.created_at,
    amountPaid: Number(row.amount_paid || 0),
    currency: row.currency || 'INR',
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method || '',
    customer: {
      name: row.customer_name || '',
      pincode: row.customer_pincode || '',
      address: row.customer_address || ''
    },
    items: row.items_text || '',
    fulfillmentStatus: row.fulfillment_status || 'New',
    statusUpdatedAt: row.status_updated_at || null,
    shipment: {
      syncStatus: 'pending',
      shiprocketOrderId: '',
      shipmentId: '',
      awbCode: '',
      courierName: '',
      shiprocketStatus: '',
      updatedAt: ''
    }
  }));
  return json(200, {
    mobile: `+91 ${session.mobile.slice(0, 2)}******${session.mobile.slice(-2)}`,
    orders
  });
}

async function sha1Hex(value) {
  return bytesToHex(await crypto.subtle.digest('SHA-1', encoder.encode(value)));
}

async function handleCustomizeUpload(request, env) {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw httpError(503, 'Cloudinary upload is not configured in Cloudflare.');
  }
  const form = await request.formData();
  const file = form.get('designPhoto');
  if (!file || typeof file.arrayBuffer !== 'function') throw httpError(400, 'Please upload your design photo.');
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(String(file.type || '').toLowerCase())) throw httpError(400, 'Only JPG, PNG or WEBP images are allowed.');
  if (Number(file.size || 0) > 8 * 1024 * 1024) throw httpError(413, 'Image must be 8 MB or smaller.');
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'royalwrap-customize';
  const signature = await sha1Hex(`folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`);
  const upload = new FormData();
  upload.set('file', file, file.name || `custom-${timestamp}`);
  upload.set('api_key', env.CLOUDINARY_API_KEY);
  upload.set('timestamp', String(timestamp));
  upload.set('folder', folder);
  upload.set('signature', signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/upload`, {
    method: 'POST',
    body: upload
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) throw httpError(502, data.error?.message || 'Photo upload failed.');
  if (env.DB) {
    await env.DB.prepare(`INSERT INTO custom_uploads (id, image_url, public_id, created_at) VALUES (?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), data.secure_url, data.public_id || '', new Date().toISOString()).run();
  }
  return json(200, {
    success: true,
    message: 'Photo uploaded successfully.',
    orderId: `CUSTOM-${Date.now()}`,
    imageUrl: data.secure_url
  });
}

export async function handleApiRequest(request, env, path) {
  try {
    const method = request.method.toUpperCase();
    const cleanPath = `/${String(path || '').replace(/^\/+|\/+$/g, '')}`;
    if (method === 'GET' && cleanPath === '/health') {
      return json(200, { ok: true, service: 'RoyalWraps Cloudflare API', database: Boolean(env.DB) });
    }
    if (method === 'GET' && cleanPath === '/store') {
      return json(200, {
        name: env.STORE_NAME || 'RoyalWraps',
        email: env.STORE_EMAIL || '',
        mobile: env.STORE_MOBILE || '',
        currency: 'INR'
      });
    }
    if (method === 'GET' && cleanPath === '/razorpay-key') {
      assertRazorpay(env);
      return json(200, { key: env.RAZORPAY_KEY_ID });
    }
    if (method === 'POST' && cleanPath === '/create-order') return handleCreateOrder(request, env);
    if (method === 'POST' && cleanPath === '/verify-payment') return handleVerifyPayment(request, env);
    if (method === 'POST' && cleanPath === '/customize-order') return handleCustomizeUpload(request, env);
    if (method === 'POST' && ['/customer/auth/send-otp', '/customer/otp/send'].includes(cleanPath)) return handleOtpSend(request, env);
    if (method === 'POST' && ['/customer/auth/verify-otp', '/customer/otp/verify'].includes(cleanPath)) return handleOtpVerify(request, env);
    if (method === 'GET' && cleanPath === '/customer/auth/session') return handleSession(request, env);
    if (method === 'POST' && cleanPath === '/customer/auth/logout') {
      return json(200, { success: true }, { 'Set-Cookie': clearSessionCookie() });
    }
    if (method === 'POST' && cleanPath === '/customer/orders') return handleOrders(request, env);
    return json(404, { error: 'API route not found.' });
  } catch (error) {
    console.error('RoyalWrap Cloudflare API error:', error);
    return json(Number(error?.status || 500), { error: error?.message || 'Something went wrong.' });
  }
}
