const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const STORE_NAME = process.env.STORE_NAME || 'RoyalWraps';
const STORE_EMAIL = process.env.STORE_EMAIL || 'sumitsharma22112004@gmail.com';
const STORE_MOBILE = process.env.STORE_MOBILE || '8000520058';

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const uploadDir = path.join(__dirname, 'uploads', 'customize');
const dataDir = path.join(__dirname, 'data');
const customizeOrdersFile = path.join(dataDir, 'customize-orders.json');

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

const customizeUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const fileName = `custom_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
      cb(null, fileName);
    }
  }),
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG or WEBP images are allowed.'));
    }

    cb(null, true);
  }
});

function readCustomizeOrders() {
  if (!fs.existsSync(customizeOrdersFile)) return [];

  try {
    return JSON.parse(fs.readFileSync(customizeOrdersFile, 'utf8'));
  } catch {
    return [];
  }
}

function saveCustomizeOrder(order) {
  const orders = readCustomizeOrders();
  orders.push(order);
  fs.writeFileSync(customizeOrdersFile, JSON.stringify(orders, null, 2));
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const productCatalog = {
  'ayodhya-mandir': { name: 'Ayodhya Mandir Heritage Skin', price: 599 },
  'lotus-jaali': { name: 'Lotus Jaali Palace Skin', price: 599 },
  'cosmic-galaxy': { name: 'Cosmic Galaxy Vortex Skin', price: 599 },
  'obsidian-diamond': { name: 'Obsidian Diamond Armor Skin', price: 599 },
  'honeycomb-pro': { name: 'Honeycomb Copper Pro Skin', price: 599 },
  'peacock-krishna': { name: 'Peacock Jewel Krishna Skin', price: 599 },
  'luxury-leather': { name: 'Luxury Quilted Leather Skin', price: 599 },
  'emerald-marble': { name: 'Emerald Marble Gold Skin', price: 599 },
  'sapphire-marble': { name: 'Sapphire Marble Gold Skin', price: 599 },
  'royal-midnight': { name: 'Royal Midnight Palace Skin', price: 599 }
};

const OTHER_MODEL_VALUE = '__other__';

const phoneModels = {
  Apple: [
    'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16', 'iPhone 16e',
    'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
    'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
    'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13 Mini', 'iPhone 13',
    'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12 Mini', 'iPhone 12',
    'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
    'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X',
    'iPhone SE 3rd Gen', 'iPhone SE 2nd Gen',
    'iPhone 8 Plus', 'iPhone 8', 'iPhone 7 Plus', 'iPhone 7',
    'iPhone 6s Plus', 'iPhone 6s', 'iPhone 6 Plus', 'iPhone 6'
  ],
  Samsung: [
    'Galaxy S25 Ultra', 'Galaxy S25 Plus', 'Galaxy S25', 'Galaxy S25 Edge',
    'Galaxy S24 Ultra', 'Galaxy S24 Plus', 'Galaxy S24', 'Galaxy S24 FE',
    'Galaxy S23 Ultra', 'Galaxy S23 Plus', 'Galaxy S23', 'Galaxy S23 FE',
    'Galaxy S22 Ultra', 'Galaxy S22 Plus', 'Galaxy S22',
    'Galaxy S21 Ultra', 'Galaxy S21 Plus', 'Galaxy S21', 'Galaxy S21 FE',
    'Galaxy Note 20 Ultra', 'Galaxy Note 20',
    'Galaxy Z Fold 6', 'Galaxy Z Fold 5', 'Galaxy Z Fold 4', 'Galaxy Z Fold 3',
    'Galaxy Z Flip 6', 'Galaxy Z Flip 5', 'Galaxy Z Flip 4', 'Galaxy Z Flip 3',
    'Galaxy A56 5G', 'Galaxy A55 5G', 'Galaxy A54 5G', 'Galaxy A53 5G', 'Galaxy A52s 5G', 'Galaxy A52',
    'Galaxy A36 5G', 'Galaxy A35 5G', 'Galaxy A34 5G', 'Galaxy A33 5G',
    'Galaxy A26 5G', 'Galaxy A25 5G', 'Galaxy A24', 'Galaxy A23 5G', 'Galaxy A23',
    'Galaxy A16 5G', 'Galaxy A15 5G', 'Galaxy A14 5G', 'Galaxy A13',
    'Galaxy M55 5G', 'Galaxy M54 5G', 'Galaxy M53 5G', 'Galaxy M35 5G', 'Galaxy M34 5G', 'Galaxy M33 5G', 'Galaxy M15 5G', 'Galaxy M14 5G',
    'Galaxy F55 5G', 'Galaxy F54 5G', 'Galaxy F34 5G', 'Galaxy F15 5G', 'Galaxy F14 5G'
  ],
  OnePlus: [
    'OnePlus 13', 'OnePlus 13R', 'OnePlus 12', 'OnePlus 12R',
    'OnePlus 11', 'OnePlus 11R', 'OnePlus 10 Pro', 'OnePlus 10T', 'OnePlus 10R',
    'OnePlus 9 Pro', 'OnePlus 9RT', 'OnePlus 9R', 'OnePlus 9',
    'OnePlus 8 Pro', 'OnePlus 8T', 'OnePlus 8',
    'OnePlus Nord 4', 'OnePlus Nord 3', 'OnePlus Nord 2T', 'OnePlus Nord 2', 'OnePlus Nord',
    'OnePlus Nord CE4', 'OnePlus Nord CE4 Lite', 'OnePlus Nord CE3', 'OnePlus Nord CE3 Lite',
    'OnePlus Nord CE2', 'OnePlus Nord CE2 Lite', 'OnePlus Nord N30', 'OnePlus Nord N20'
  ],
  Xiaomi: [
    'Xiaomi 15 Ultra', 'Xiaomi 15', 'Xiaomi 14 Ultra', 'Xiaomi 14', 'Xiaomi 14 Civi',
    'Xiaomi 13 Pro', 'Xiaomi 13', 'Xiaomi 12 Pro', 'Xiaomi 12', 'Xiaomi 11T Pro',
    'Redmi Note 14 Pro Plus', 'Redmi Note 14 Pro', 'Redmi Note 14',
    'Redmi Note 13 Pro Plus', 'Redmi Note 13 Pro', 'Redmi Note 13',
    'Redmi Note 12 Pro Plus', 'Redmi Note 12 Pro', 'Redmi Note 12',
    'Redmi Note 11 Pro Plus', 'Redmi Note 11 Pro', 'Redmi Note 11',
    'Redmi 14C', 'Redmi 13 5G', 'Redmi 13C', 'Redmi 12 5G', 'Redmi 12', 'Redmi 12C',
    'Redmi 11 Prime 5G', 'Redmi 10 Prime', 'Redmi 10A', 'Redmi K50i'
  ],
  Poco: [
    'Poco F7 Pro', 'Poco F7', 'Poco F6 Pro', 'Poco F6', 'Poco F5', 'Poco F4 5G',
    'Poco X7 Pro', 'Poco X7', 'Poco X6 Pro', 'Poco X6', 'Poco X5 Pro', 'Poco X5', 'Poco X4 Pro', 'Poco X4', 'Poco X3 Pro', 'Poco X3', 'Poco X2',
    'Poco M7 Pro', 'Poco M6 Pro', 'Poco M6', 'Poco M5', 'Poco M4 Pro',
    'Poco C75', 'Poco C65', 'Poco C61', 'Poco C55', 'Poco C50'
  ],
  Vivo: [
    'Vivo X200 Pro', 'Vivo X200', 'Vivo X100 Pro', 'Vivo X100',
    'Vivo V50 Pro', 'Vivo V50', 'Vivo V40 Pro', 'Vivo V40', 'Vivo V30 Pro', 'Vivo V30',
    'Vivo V29 Pro', 'Vivo V29', 'Vivo V27 Pro', 'Vivo V27', 'Vivo V25 Pro', 'Vivo V25', 'Vivo V23 Pro', 'Vivo V23',
    'Vivo T4 5G', 'Vivo T3 Pro 5G', 'Vivo T3 5G', 'Vivo T3x 5G', 'Vivo T2 Pro 5G', 'Vivo T2 5G',
    'Vivo Y300 5G', 'Vivo Y200 5G', 'Vivo Y100', 'Vivo Y58 5G', 'Vivo Y56 5G', 'Vivo Y36', 'Vivo Y28 5G', 'Vivo Y22', 'Vivo Y21', 'Vivo Y18', 'Vivo Y16'
  ],
  Oppo: [
    'Oppo Find X8 Pro', 'Oppo Find X8', 'Oppo Find X7 Ultra', 'Oppo Find X7',
    'Oppo Reno 13 Pro', 'Oppo Reno 13', 'Oppo Reno 12 Pro', 'Oppo Reno 12',
    'Oppo Reno 11 Pro', 'Oppo Reno 11', 'Oppo Reno 10 Pro Plus', 'Oppo Reno 10 Pro', 'Oppo Reno 10',
    'Oppo Reno 8 Pro', 'Oppo Reno 8',
    'Oppo F29 Pro', 'Oppo F29', 'Oppo F27 Pro Plus', 'Oppo F25 Pro', 'Oppo F23', 'Oppo F21 Pro',
    'Oppo K12x 5G', 'Oppo A79 5G', 'Oppo A78 5G', 'Oppo A77', 'Oppo A59 5G', 'Oppo A58', 'Oppo A57', 'Oppo A55', 'Oppo A38', 'Oppo A18'
  ],
  Realme: [
    'Realme GT 7 Pro', 'Realme GT 6', 'Realme GT 6T', 'Realme GT Neo 3', 'Realme X7 Max',
    'Realme 14 Pro Plus', 'Realme 14 Pro', 'Realme 14x',
    'Realme 13 Pro Plus', 'Realme 13 Pro', 'Realme 13',
    'Realme 12 Pro Plus', 'Realme 12 Pro', 'Realme 12 Plus', 'Realme 12',
    'Realme 11 Pro Plus', 'Realme 11 Pro', 'Realme 11',
    'Realme 10 Pro Plus', 'Realme 10 Pro', 'Realme 10',
    'Realme Narzo 80 Pro', 'Realme Narzo 70 Pro', 'Realme Narzo 70', 'Realme Narzo 60 Pro', 'Realme Narzo 60',
    'Realme Narzo N65', 'Realme Narzo N55',
    'Realme C75', 'Realme C67 5G', 'Realme C65', 'Realme C55', 'Realme C53', 'Realme C35'
  ],
  Motorola: [
    'Motorola Edge 60 Pro', 'Motorola Edge 60 Fusion', 'Motorola Edge 50 Ultra', 'Motorola Edge 50 Pro', 'Motorola Edge 50 Fusion', 'Motorola Edge 50 Neo',
    'Motorola Edge 40', 'Motorola Edge 40 Neo', 'Motorola Edge 30',
    'Motorola Razr 50 Ultra', 'Motorola Razr 50', 'Motorola Razr 40 Ultra', 'Motorola Razr 40',
    'Moto G96 5G', 'Moto G85 5G', 'Moto G84 5G', 'Moto G73 5G', 'Moto G72',
    'Moto G64 5G', 'Moto G62 5G', 'Moto G60', 'Moto G54 5G', 'Moto G52',
    'Moto G45 5G', 'Moto G34 5G', 'Moto G32', 'Moto G31', 'Moto G24', 'Moto G14', 'Moto E13'
  ],
  Nothing: [
    'Nothing Phone 3', 'Nothing Phone 3a Pro', 'Nothing Phone 3a',
    'Nothing Phone 2a Plus', 'Nothing Phone 2a', 'Nothing Phone 2', 'Nothing Phone 1',
    'CMF Phone 2 Pro', 'CMF Phone 1'
  ],
  iQOO: [
    'iQOO 13', 'iQOO 12', 'iQOO 11', 'iQOO 9 Pro', 'iQOO 9 SE', 'iQOO 9', 'iQOO 7 Legend', 'iQOO 7',
    'iQOO Neo 10R', 'iQOO Neo 9 Pro', 'iQOO Neo 7 Pro', 'iQOO Neo 7', 'iQOO Neo 6',
    'iQOO Z10', 'iQOO Z9', 'iQOO Z9x', 'iQOO Z9 Lite', 'iQOO Z7 Pro', 'iQOO Z7', 'iQOO Z6 Pro', 'iQOO Z6 Lite', 'iQOO Z5'
  ]
};

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret || keyId.includes('your_key') || keySecret.includes('your_key')) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}

function normaliseCart(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('Cart is empty.');
    error.statusCode = 400;
    throw error;
  }

  const cleanItems = [];
  const quantityByKey = new Map();

  for (const item of items) {
    const id = String(item.id || '').trim();
    const brand = String(item.brand || '').trim();
    const model = String(item.model || '').trim();
    const qty = Number.parseInt(item.qty, 10);

    if (!productCatalog[id]) {
      const error = new Error(`Invalid product: ${id || 'unknown'}`);
      error.statusCode = 400;
      throw error;
    }

    if (!phoneModels[brand]) {
      const error = new Error('Please select a valid mobile brand for every item.');
      error.statusCode = 400;
      throw error;
    }

    const customModelSelected = model.startsWith('Other: ') && model.replace('Other: ', '').trim().length >= 2 && model.length <= 70;
    if (!phoneModels[brand].includes(model) && !customModelSelected) {
      const error = new Error('Please select a valid mobile model for every item.');
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
      const error = new Error('Quantity must be between 1 and 10 for each product.');
      error.statusCode = 400;
      throw error;
    }

    const key = `${id}__${brand}__${model}`;
    const existing = quantityByKey.get(key) || { id, brand, model, qty: 0 };
    existing.qty += qty;
    quantityByKey.set(key, existing);
  }

  for (const item of quantityByKey.values()) {
    if (item.qty > 10) {
      const error = new Error('Maximum 10 quantity allowed per product and mobile model.');
      error.statusCode = 400;
      throw error;
    }

    const product = productCatalog[item.id];
    cleanItems.push({
      id: item.id,
      name: product.name,
      brand: item.brand,
      model: item.model,
      qty: item.qty,
      unitPrice: product.price,
      lineTotal: product.price * item.qty
    });
  }

  const amount = cleanItems.reduce((sum, item) => sum + item.lineTotal, 0);
  return { cleanItems, amount };
}

function validateCustomer(customer = {}) {
  const name = String(customer.name || '').trim();
  const email = String(customer.email || '').trim();
  const mobile = String(customer.mobile || '').replace(/\D/g, '').slice(0, 10);
  const pincode = String(customer.pincode || '').replace(/\D/g, '').slice(0, 6);
  const address = String(customer.address || '').trim();

  if (name.length < 2) {
    const error = new Error('Please enter customer name.');
    error.statusCode = 400;
    throw error;
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    const error = new Error('Please enter a valid email address.');
    error.statusCode = 400;
    throw error;
  }

  if (!/^\d{10}$/.test(mobile)) {
    const error = new Error('Please enter exactly 10 digits in mobile number.');
    error.statusCode = 400;
    throw error;
  }

  if (!/^\d{6}$/.test(pincode)) {
    const error = new Error('Please enter exactly 6 digits in pin code.');
    error.statusCode = 400;
    throw error;
  }

  if (address.length < 10) {
    const error = new Error('Please enter complete delivery address.');
    error.statusCode = 400;
    throw error;
  }

  return { name, email, mobile, pincode, address };
}

app.get('/api/store', (_req, res) => {
  res.json({
    name: STORE_NAME,
    email: STORE_EMAIL,
    mobile: STORE_MOBILE,
    currency: 'INR'
  });
});

app.get('/api/razorpay-key', (_req, res) => {
  if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('your_key')) {
    return res.status(500).json({
      error: 'Razorpay key is missing. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.'
    });
  }

  res.json({ key: process.env.RAZORPAY_KEY_ID });
});

app.post('/api/create-order', async (req, res, next) => {
  try {
    const razorpay = getRazorpayInstance();
    if (!razorpay) {
      return res.status(500).json({
        error: 'Razorpay is not configured. Copy .env.example to .env and add your real test/live keys.'
      });
    }

    const { cleanItems, amount } = normaliseCart(req.body.items);
    const customer = validateCustomer(req.body.customer);
    const receipt = `rw_${Date.now()}`;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt,
      notes: {
        customer_name: customer.name,
        customer_email: customer.email,
        customer_mobile: customer.mobile,
        customer_pincode: customer.pincode,
        customer_address: `${customer.address}, PIN: ${customer.pincode}`.slice(0, 250),
        items: cleanItems.map((item) => `${item.name} (${item.brand} ${item.model}) x ${item.qty}`).join(', ').slice(0, 250)
      }
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      displayAmount: amount,
      currency: order.currency,
      receipt,
      items: cleanItems,
      customer
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/verify-payment', (req, res, next) => {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret || keySecret.includes('your_key')) {
      return res.status(500).json({ error: 'Razorpay secret is missing.' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      const error = new Error('Payment verification fields are missing.');
      error.statusCode = 400;
      throw error;
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(String(razorpay_signature));

    const isValid = expectedBuffer.length === receivedBuffer.length
      && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!isValid) {
      const error = new Error('Invalid payment signature.');
      error.statusCode = 400;
      throw error;
    }

    res.json({
      success: true,
      message: 'Payment verified successfully.',
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id
    });
  } catch (error) {
    next(error);
  }
});
app.post('/api/customize-order', customizeUpload.single('designPhoto'), (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const mobile = String(req.body.mobile || '').replace(/\D/g, '').slice(0, 10);
    const brand = String(req.body.mobileBrand || '').trim();
    const model = String(req.body.mobileModel || '').trim();
    const designNote = String(req.body.designNote || '').trim();

    if (name.length < 2) {
      const error = new Error('Please enter customer name.');
      error.statusCode = 400;
      throw error;
    }

    if (!/^\d{10}$/.test(mobile)) {
      const error = new Error('Please enter exactly 10 digits mobile number.');
      error.statusCode = 400;
      throw error;
    }

    if (!brand || !model) {
      const error = new Error('Please select mobile brand and model.');
      error.statusCode = 400;
      throw error;
    }

    if (!req.file) {
      const error = new Error('Please upload your design photo.');
      error.statusCode = 400;
      throw error;
    }

    const order = {
      id: `CUSTOM-${Date.now()}`,
      createdAt: new Date().toISOString(),
      name,
      mobile,
      brand,
      model,
      designNote,
      originalFileName: req.file.originalname,
      savedFileName: req.file.filename,
      fileUrl: `/uploads/customize/${req.file.filename}`
    };

    saveCustomizeOrder(order);

    res.json({
      success: true,
      message: 'Customize request saved successfully.',
      orderId: order.id
    });
  } catch (error) {
    next(error);
  }
});
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: STORE_NAME });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error, _req, res, _next) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    error: error.message || 'Something went wrong.'
  });
});

app.listen(PORT, () => {
  console.log(`${STORE_NAME} running at http://localhost:${PORT}`);
});
