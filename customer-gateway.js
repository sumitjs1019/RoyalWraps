const http = require('http');
const {
  handleCustomerOtpSend,
  handleCustomerOtpVerify,
  handleCustomerSession,
  handleCustomerLogout,
  handleCustomerOrders
} = require('./customer-orders-service');
require('dotenv').config();

const publicPort = Number(process.env.PORT || 3000);
let ordersGatewayPort = Number(process.env.ROYALWRAP_ORDERS_GATEWAY_PORT || 3201);
if (ordersGatewayPort === publicPort) ordersGatewayPort += 1;

// Start the existing Razorpay/admin gateway internally. It starts the core store
// server on ROYALWRAP_INTERNAL_PORT and does not create Shiprocket orders.
process.env.PORT = String(ordersGatewayPort);
require('./orders-gateway');
process.env.PORT = String(publicPort);

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function proxyToOrdersGateway(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${ordersGatewayPort}` };
  const proxyRequest = http.request({
    hostname: '127.0.0.1',
    port: ordersGatewayPort,
    path: req.url,
    method: req.method,
    headers
  }, (proxyResponse) => {
    res.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
    proxyResponse.pipe(res);
  });

  proxyRequest.on('error', (error) => {
    if (!res.headersSent) {
      sendJson(res, 502, { error: `RoyalWrap backend is unavailable: ${error.message}` });
    } else {
      res.end();
    }
  });

  req.pipe(proxyRequest);
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'POST' && ['/api/customer/auth/send-otp', '/api/customer/otp/send'].includes(url.pathname)) {
      return await handleCustomerOtpSend(req, res);
    }
    if (req.method === 'POST' && ['/api/customer/auth/verify-otp', '/api/customer/otp/verify'].includes(url.pathname)) {
      return await handleCustomerOtpVerify(req, res);
    }
    if (req.method === 'GET' && url.pathname === '/api/customer/auth/session') {
      return handleCustomerSession(req, res);
    }
    if (req.method === 'POST' && url.pathname === '/api/customer/auth/logout') {
      return handleCustomerLogout(req, res);
    }
    if (req.method === 'POST' && url.pathname === '/api/customer/orders') {
      return await handleCustomerOrders(req, res);
    }

    return proxyToOrdersGateway(req, res);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: error.message || 'RoyalWrap customer service failed.'
    });
  }
}).listen(publicPort, () => {
  console.log(`RoyalWrap customer gateway running at http://localhost:${publicPort}`);
});
