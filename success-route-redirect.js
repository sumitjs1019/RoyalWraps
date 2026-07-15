'use strict';

const http = require('http');
const originalCreateServer = http.createServer;

http.createServer = function createServerWithOrderRedirect(...args) {
  if (typeof args[0] === 'function') {
    const listener = args[0];
    args[0] = function redirectDeletedSuccessPage(req, res) {
      let pathname = '';
      try {
        pathname = new URL(req.url || '/', 'http://royalwrap.local').pathname;
      } catch {}

      if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/order-success.html') {
        res.writeHead(302, {
          Location: '/my-orders.html',
          'Cache-Control': 'no-store'
        });
        res.end();
        return;
      }

      return listener.call(this, req, res);
    };
  }

  return originalCreateServer.apply(this, args);
};
