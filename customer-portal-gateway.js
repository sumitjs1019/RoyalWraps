const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const publicPort = Number(process.env.PORT || 3000);
const ordersPort = Number(process.env.ORDERS_GATEWAY_PORT || 3201);
const storePort = Number(process.env.ROYALWRAP_INTERNAL_PORT || 3101);
const adminKey = String(process.env.ADMIN_KEY || '');
const sessionSecret = String(process.env.CUSTOMER_SESSION_SECRET || '');
const dataDir = path.join(__dirname, 'data');
const accountsFile = path.join(dataDir, 'tracking-accounts.json');
const cookieName = 'rw_tracking_session';
const sessionSeconds = 30 * 24 * 60 * 60;
const validStatuses = new Set(['Order Confirmed','Processing','Printed','Shipped','Out for Delivery','Delivered','Cancelled']);

fs.mkdirSync(dataDir, { recursive: true });

function safeEqual(a,b){const x=Buffer.from(String(a||''));const y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function sendJson(res,status,payload,headers={}){const body=JSON.stringify(payload);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store',...headers});res.end(body);}
function readBody(req,limit=65536){return new Promise((resolve,reject)=>{let body='';req.setEncoding('utf8');req.on('data',chunk=>{body+=chunk;if(Buffer.byteLength(body)>limit){reject(Object.assign(new Error('Request is too large.'),{statusCode:413}));req.destroy();}});req.on('end',()=>{if(!body)return resolve({});try{resolve(JSON.parse(body));}catch{reject(Object.assign(new Error('Invalid JSON body.'),{statusCode:400}));}});req.on('error',reject);});}
function normalizeMobile(value){const digits=String(value||'').replace(/\D/g,'');return digits.length>=10?digits.slice(-10):digits;}
function readAccounts(){try{if(!fs.existsSync(accountsFile))return[];const data=JSON.parse(fs.readFileSync(accountsFile,'utf8'));return Array.isArray(data)?data:[];}catch{return[];}}
function writeAccounts(accounts){const temp=`${accountsFile}.tmp`;fs.writeFileSync(temp,JSON.stringify(accounts,null,2));fs.renameSync(temp,accountsFile);}
function encode(value){return Buffer.from(value).toString('base64url');}
function decode(value){return Buffer.from(value,'base64url').toString('utf8');}
function createToken(mobile){if(sessionSecret.length<24)throw Object.assign(new Error('CUSTOMER_SESSION_SECRET is not configured.'),{statusCode:503});const payload=encode(JSON.stringify({mobile,exp:Math.floor(Date.now()/1000)+sessionSeconds}));const sig=crypto.createHmac('sha256',sessionSecret).update(payload).digest('hex');return `${payload}.${sig}`;}
function verifyToken(token){if(!token||sessionSecret.length<24)return null;const [payload,sig]=String(token).split('.');if(!payload||!sig)return null;const expected=crypto.createHmac('sha256',sessionSecret).update(payload).digest('hex');if(!safeEqual(sig,expected))return null;try{const data=JSON.parse(decode(payload));if(!data.mobile||data.exp<=Math.floor(Date.now()/1000))return null;return data;}catch{return null;}}
function cookies(req){const result={};String(req.headers.cookie||'').split(';').forEach(part=>{const i=part.indexOf('=');if(i<0)return;const key=part.slice(0,i).trim();if(key)result[key]=decodeURIComponent(part.slice(i+1).trim());});return result;}
function cookieHeader(req,value,maxAge=sessionSeconds){const secure=String(req.headers['x-forwarded-proto']||'').toLowerCase()==='https'||process.env.NODE_ENV==='production';return `${cookieName}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;}
function scrypt(password,salt){return new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key)));}
async function hashPassword(password){const salt=crypto.randomBytes(16).toString('hex');const key=await scrypt(password,salt);return `scrypt$${salt}$${key.toString('hex')}`;}
async function checkPassword(password,stored){const [type,salt,key]=String(stored||'').split('$');if(type!=='scrypt'||!salt||!key)return false;const actual=await scrypt(password,salt);return safeEqual(actual.toString('hex'),key);}
function publicAccount(account){return{name:account.name,mobile:account.mobile,orders:[...(account.orders||[])].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt))};}
function validUrl(value){const raw=String(value||'').trim();if(!raw)return'';let url;try{url=new URL(raw);}catch{throw Object.assign(new Error('Enter a valid tracking URL.'),{statusCode:400});}if(url.protocol!=='https:')throw Object.assign(new Error('Tracking URL must start with https://'),{statusCode:400});return url.toString();}
function isAdmin(req){return adminKey.length>=8&&safeEqual(req.headers['x-admin-key'],adminKey);}

async function handleApi(req,res,url){
  if(url.pathname.startsWith('/api/tracking-admin/')){
    if(!isAdmin(req))return sendJson(res,401,{error:'Invalid admin key.'});
    if(req.method==='GET'&&url.pathname==='/api/tracking-admin/customers')return sendJson(res,200,{customers:readAccounts().map(publicAccount)});
    if(req.method==='POST'&&url.pathname==='/api/tracking-admin/customers'){
      const body=await readBody(req);const mobile=normalizeMobile(body.mobile);const name=String(body.name||'').trim();const password=String(body.password||'');
      const orderReference=String(body.orderReference||'').trim();const productSummary=String(body.productSummary||'').trim();const amount=Number(body.amount||0);const status=String(body.status||'Order Confirmed').trim();
      const carrier=String(body.carrier||'Amazon Shipping').trim().slice(0,80);const trackingNumber=String(body.trackingNumber||'').trim().slice(0,100);const trackingUrl=validUrl(body.trackingUrl);const recordId=String(body.recordId||'').trim();
      if(!/^\d{10}$/.test(mobile))return sendJson(res,400,{error:'Mobile number must contain exactly 10 digits.'});
      if(name.length<2)return sendJson(res,400,{error:'Enter customer name.'});
      if(!orderReference||!productSummary)return sendJson(res,400,{error:'Order reference and product details are required.'});
      if(!validStatuses.has(status))return sendJson(res,400,{error:'Invalid order status.'});
      const accounts=readAccounts();let account=accounts.find(item=>item.mobile===mobile);
      if(!account&&password.length<8)return sendJson(res,400,{error:'New customer password must contain at least 8 characters.'});
      if(password&&password.length<8)return sendJson(res,400,{error:'Password must contain at least 8 characters.'});
      const now=new Date().toISOString();
      if(!account){account={name,mobile,passwordHash:await hashPassword(password),orders:[],createdAt:now,updatedAt:now};accounts.push(account);}else{account.name=name;account.updatedAt=now;if(password)account.passwordHash=await hashPassword(password);}
      const index=recordId?account.orders.findIndex(order=>order.id===recordId):-1;
      const old=index>=0?account.orders[index]:null;
      const record={id:old?.id||crypto.randomUUID(),orderReference,productSummary,amount:Number.isFinite(amount)?amount:0,status,carrier,trackingNumber,trackingUrl,createdAt:old?.createdAt||now,updatedAt:now};
      if(index>=0)account.orders[index]=record;else account.orders.push(record);
      writeAccounts(accounts);return sendJson(res,200,{success:true,customer:publicAccount(account),record});
    }
    return sendJson(res,404,{error:'Tracking admin route not found.'});
  }

  if(req.method==='POST'&&url.pathname==='/api/tracking/login'){
    const body=await readBody(req);const mobile=normalizeMobile(body.mobile);const password=String(body.password||'');
    const account=readAccounts().find(item=>item.mobile===mobile);
    if(!account||!(await checkPassword(password,account.passwordHash)))return sendJson(res,401,{error:'Mobile number or password is incorrect.'});
    return sendJson(res,200,{authenticated:true,customer:publicAccount(account)},{'Set-Cookie':cookieHeader(req,createToken(mobile))});
  }
  if(req.method==='GET'&&url.pathname==='/api/tracking/session'){
    const session=verifyToken(cookies(req)[cookieName]);if(!session)return sendJson(res,200,{authenticated:false});
    const account=readAccounts().find(item=>item.mobile===normalizeMobile(session.mobile));if(!account)return sendJson(res,200,{authenticated:false},{'Set-Cookie':cookieHeader(req,'',0)});
    return sendJson(res,200,{authenticated:true,customer:publicAccount(account)});
  }
  if(req.method==='POST'&&url.pathname==='/api/tracking/logout')return sendJson(res,200,{success:true},{'Set-Cookie':cookieHeader(req,'',0)});
  return sendJson(res,404,{error:'Tracking route not found.'});
}

function proxy(req,res){const request=http.request({hostname:'127.0.0.1',port:ordersPort,path:req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${ordersPort}`}},response=>{res.writeHead(response.statusCode||502,response.headers);response.pipe(res);});request.on('error',error=>sendJson(res,502,{error:`Store is unavailable: ${error.message}`}));req.pipe(request);}

process.env.PORT=String(ordersPort);
process.env.ROYALWRAP_INTERNAL_PORT=String(storePort);
require('./orders-gateway');
process.env.PORT=String(publicPort);

http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname.startsWith('/api/tracking'))return await handleApi(req,res,url);return proxy(req,res);}catch(error){return sendJson(res,error.statusCode||500,{error:error.message||'Tracking request failed.'});}}).listen(publicPort,()=>console.log(`RoyalWrap customer portal running at http://localhost:${publicPort}`));
