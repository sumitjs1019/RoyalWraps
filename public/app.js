const ORIGINAL_PRICE = 719;
const DISCOUNT_PERCENT = 20;
const DISCOUNT_AMOUNT = 120;
const SELLING_PRICE = ORIGINAL_PRICE - DISCOUNT_AMOUNT;

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

const products = [

   {
    id: 'royal-midnight',
    name: 'Royal Midnight Palace Skin',
    price: SELLING_PRICE,
    originalPrice: ORIGINAL_PRICE,
    discountPercent: DISCOUNT_PERCENT,
    discountAmount: DISCOUNT_AMOUNT,
    tag: 'Royal Edition',
    image: 'assets/products/royal-midnight.png',
    description: 'Midnight blue palace pattern with gold borders, floral details and luxury royal depth.'
  },
 
 
  {
    id: 'obsidian-diamond',
    name: 'Obsidian Diamond Armor Skin',
    price: SELLING_PRICE,
    originalPrice: ORIGINAL_PRICE,
    discountPercent: DISCOUNT_PERCENT,
    discountAmount: DISCOUNT_AMOUNT,
    tag: 'Stealth Pro',
    image: 'assets/products/obsidian-diamond.png',
    description: 'Matte black geometric diamond panels with a technical, minimal and powerful look.'
  },

  {
    id: 'peacock-krishna',
    name: 'Peacock Jewel Krishna Skin',
    price: SELLING_PRICE,
    originalPrice: ORIGINAL_PRICE,
    discountPercent: DISCOUNT_PERCENT,
    discountAmount: DISCOUNT_AMOUNT,
    tag: 'Royal Jewel',
    image: 'assets/products/peacock-krishna.png',
    description: 'Peacock feather jewel artwork with blue, green and gold detailing for a royal Indian statement.'
  },
  {
    id: 'sapphire-marble',
    name: 'Sapphire Marble Gold Skin',
    price: SELLING_PRICE,
    originalPrice: ORIGINAL_PRICE,
    discountPercent: DISCOUNT_PERCENT,
    discountAmount: DISCOUNT_AMOUNT,
    tag: 'Marble Luxury',
    image: 'assets/products/sapphire-marble.png',
    description: 'Sapphire blue marble skin with premium gold cracks and dramatic studio styling.'
  },
  {
    id: 'bhagwan-ram',
    name: 'Bhagwan Ram Skin',
    price: SELLING_PRICE,
    originalPrice: ORIGINAL_PRICE,
    discountPercent: DISCOUNT_PERCENT,
    discountAmount: DISCOUNT_AMOUNT,
    tag: 'God',
    image: 'assets/products/bhagwan-ram.jpeg',
    description: 'Animated Bhagwan Ram Premium 3D Printed Mobile skin.'
  }
];
const CUSTOM_PRODUCT = {
  id: 'custom-mobile-skin',
  name: 'Custom Photo Mobile Skin',
  price: SELLING_PRICE,
  originalPrice: ORIGINAL_PRICE,
  discountPercent: DISCOUNT_PERCENT,
  discountAmount: DISCOUNT_AMOUNT,
  tag: 'Custom Upload',
  image: 'assets/royalwraps-logo-icon.png',
  description: 'Customer uploaded photo/design custom mobile skin.'
};
const productGrid = document.getElementById('productGrid');
const cartCount = document.getElementById('cartCount');
const openCartBtn = document.getElementById('openCart');
const closeCartBtn = document.getElementById('closeCart');
const cartDrawer = document.getElementById('cartDrawer');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const checkoutForm = document.getElementById('checkoutForm');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutStatus = document.getElementById('checkoutStatus');

const previewModal = document.getElementById('previewModal');
const previewImage = document.getElementById('previewImage');
const previewTag = document.getElementById('previewTag');
const previewTitle = document.getElementById('previewTitle');
const previewDesc = document.getElementById('previewDesc');
const previewPrice = document.getElementById('previewPrice');
const previewAddBtn = document.getElementById('previewAddBtn');
const previewSelectors = document.getElementById('previewSelectors');

const contactModal = document.getElementById('contactModal');
const refundModal = document.getElementById('refundModal');

let cart = JSON.parse(localStorage.getItem('royalwraps-cart') || '[]');
let activePreviewId = null;
let pendingCustomizeSelection = null;
let returnToCustomizeAfterModelSelection = false;

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function productPriceHTML(product) {
  return `
    <div class="price-stack">
      <strong>${formatCurrency(product.price)}</strong>
      <span class="mrp"><s>${formatCurrency(product.originalPrice)}</s></span>
      <span class="discount">${product.discountPercent}% OFF • Save ${formatCurrency(product.discountAmount)}</span>
    </div>
  `;
}
function getProduct(id) {
  if (id === CUSTOM_PRODUCT.id) return CUSTOM_PRODUCT;
  return products.find((product) => product.id === id);
}
function brandOptionsHTML() {
  return Object.keys(phoneModels)
    .map((brand) => `<option value="${escapeAttribute(brand)}">${brand}</option>`)
    .join('');
}

function modelOptionsHTML(brand = '') {
  const models = phoneModels[brand] || [];
  if (!models.length) return '';
  const modelOptions = models
    .map((model) => `<option value="${escapeAttribute(model)}">${model}</option>`)
    .join('');
  return `${modelOptions}<option value="${OTHER_MODEL_VALUE}">Other Model / Not Listed</option>`;
}

function phoneSelectorHTML(productId, context = 'card') {
  return `
    <div class="phone-selectors" data-selector-group="${context}" data-product="${productId}">
      <label class="select-field">
        <span>Mobile Brand</span>
        <select class="mobile-brand-select" data-brand-select="${productId}" required>
          <option value="">Mobile Brand</option>
          ${brandOptionsHTML()}
        </select>
      </label>
      <label class="select-field">
        <span>Mobile Model</span>
        <select class="mobile-model-select" data-model-select="${productId}" required disabled>
          <option value="">Mobile Model</option>
        </select>
      </label>
      <label class="select-field custom-model-field hidden">
        <span>Exact Model Name</span>
        <input class="custom-model-input" type="text" maxlength="60" placeholder="Enter exact model name" />
      </label>
    </div>
  `;
}

function getSelectionFromContainer(container) {
  const brand = container?.querySelector('.mobile-brand-select')?.value || '';
  const selectedModel = container?.querySelector('.mobile-model-select')?.value || '';
  const customModel = container?.querySelector('.custom-model-input')?.value.trim() || '';
  const model = selectedModel === OTHER_MODEL_VALUE ? (customModel ? `Other: ${customModel}` : '') : selectedModel;
  return { brand, model, selectedModel, customModel };
}

function getSelectionForProduct(productId) {
  const container = productGrid.querySelector(`[data-selector-group="card"][data-product="${productId}"]`);
  return getSelectionFromContainer(container);
}

function maybeReturnToCustomizeAfterSelection(container) {
  const selection = getSelectionFromContainer(container);
  const brand = String(selection.brand || '').trim();
  const model = String(selection.model || '').trim();

  if (!brand || !model) return;

  const validModels = phoneModels[brand] || [];
  const customModelSelected =
    model.startsWith('Other: ') && model.replace('Other: ', '').trim().length >= 2;

  if (!validModels.includes(model) && !customModelSelected) return;

  pendingCustomizeSelection = {
    brand,
    model,
    selectedProductId: container?.dataset.product || ''
  };

  if (returnToCustomizeAfterModelSelection) {
    returnToCustomizeAfterModelSelection = false;

    document.getElementById('customize')?.scrollIntoView({
      behavior: 'smooth'
    });

    if (customizeStatus) {
      customizeStatus.textContent = 'Now upload your photo/design.';
      customizeStatus.className = 'customize-status';
    }
  }
}

function updateCustomModelField(modelSelect) {
  const container = modelSelect.closest('.phone-selectors');
  const customField = container?.querySelector('.custom-model-field');
  const customInput = container?.querySelector('.custom-model-input');
  const shouldShow = modelSelect.value === OTHER_MODEL_VALUE;

  if (!customField || !customInput) return;
  customField.classList.toggle('hidden', !shouldShow);
  customInput.required = shouldShow;
  if (!shouldShow) customInput.value = '';
}

function updateModelSelect(brandSelect) {
  const container = brandSelect.closest('.phone-selectors');
  const modelSelect = container?.querySelector('.mobile-model-select');
  if (!modelSelect) return;

  const brand = brandSelect.value;
  modelSelect.innerHTML = `<option value="">Mobile Model</option>${modelOptionsHTML(brand)}`;
  modelSelect.disabled = !brand;
  modelSelect.value = '';
  updateCustomModelField(modelSelect);
}

function cartKey(item) {
  return [item.id, item.brand, item.model].map((part) => encodeURIComponent(part || '')).join('__');
}

function findCartItemByKey(key) {
  return cart.find((item) => cartKey(item) === key);
}

function saveCart() {
  localStorage.setItem('royalwraps-cart', JSON.stringify(cart));
}

function cartQuantity() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function cartAmount() {
  return cart.reduce((sum, item) => {
    const product = getProduct(item.id);
    return product ? sum + product.price * item.qty : sum;
  }, 0);
}

function renderProducts() {
  productGrid.innerHTML = products
    .map((product) => `
      <article class="product-card">
        <div class="product-image">
          <img src="${product.image}" alt="${product.name}" loading="lazy" />
        </div>
        <div class="product-info">
          <span class="product-tag">${product.tag}</span>
          <h3>${product.name}</h3>
          <p>${product.description}</p>
          <div class="limited-stock-badge">
              <span class="stock-dot"></span>
              Limited Stock
          </div>
          <div class="product-price">${productPriceHTML(product)}</div>
          ${phoneSelectorHTML(product.id)}
          <div class="card-actions">
           <button class="secondary-btn" data-customize="${product.id}">Customize</button>
            <button class="primary-btn" data-add="${product.id}">Add to Cart</button>
          </div>
        </div>
      </article>
    `)
    .join('');
}

function renderCart() {
  const totalQuantity = cartQuantity();
  cartCount.textContent = totalQuantity;
  cartTotal.textContent = formatCurrency(cartAmount());
  checkoutBtn.disabled = totalQuantity === 0;

  if (cart.length === 0) {
    cartItems.innerHTML = '<div class="empty-cart">Your cart is empty. Add a premium skin first.</div>';
    return;
  }

  cartItems.innerHTML = cart
    .map((item) => {
      const product = getProduct(item.id);
      if (!product) return '';
      const key = cartKey(item);
      const cartImage = item.image || product.image;
      return `
        <div class="cart-row">
         <img src="${cartImage}" alt="${product.name}" />
          <div class="cart-row-info">
            <h4>${product.name}</h4>
            <p class="cart-model">${item.brand || 'Brand not selected'} • ${item.model || 'Model not selected'}</p>
            <p>${formatCurrency(product.price * item.qty)}</p>
            <div class="qty-control" aria-label="Quantity controls for ${product.name}">
              <button class="qty-btn" data-dec="${key}" type="button">−</button>
              <span>${item.qty}</span>
              <button class="qty-btn" data-inc="${key}" type="button">+</button>
              <button class="remove-btn" data-remove="${key}" type="button">Remove</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

function addToCart(id, selection) {
  const product = getProduct(id);
  const brand = String(selection?.brand || '').trim();
  const model = String(selection?.model || '').trim();

  if (!product) return;

  if (!brand || !model) {
    if (selection?.selectedModel === OTHER_MODEL_VALUE && !selection?.customModel) {
      alert('Please enter the exact Mobile Model name.');
    } else {
      alert('Please select Mobile Brand and Mobile Model before adding this skin to cart.');
    }
    return;
  }

  const validModels = phoneModels[brand] || [];
  const customModelSelected = model.startsWith('Other: ') && model.replace('Other: ', '').trim().length >= 2;
  if (!validModels.includes(model) && !customModelSelected) {
    alert('Please select a valid Mobile Model for the selected brand.');
    return;
  }

  const existing = cart.find((item) => item.id === id && item.brand === brand && item.model === model);
  if (existing) {
    existing.qty = Math.min(existing.qty + 1, 10);
  } else {
    cart.push({ id, brand, model, qty: 1 });
  }
  saveCart();
  renderCart();
}
function addCustomUploadToCart(imageUrl, selection) {
  const id = CUSTOM_PRODUCT.id;
  const brand = selection?.brand || '';
  const model = selection?.model || '';

  const existing = cart.find((item) => item.id === id && item.brand === brand && item.model === model);

  if (existing) {
    existing.qty = Math.min(existing.qty + 1, 10);
    existing.image = imageUrl || existing.image || CUSTOM_PRODUCT.image;
  } else {
    cart.push({
      id,
      brand,
      model,
      qty: 1,
      image: imageUrl || CUSTOM_PRODUCT.image
    });
  }

  saveCart();
  renderCart();
  openCart();
}

function changeQuantity(key, change) {
  const item = findCartItemByKey(key);
  if (!item) return;
  item.qty += change;
  if (item.qty < 1) {
    cart = cart.filter((cartItem) => cartKey(cartItem) !== key);
  } else if (item.qty > 10) {
    item.qty = 10;
  }
  saveCart();
  renderCart();
}

function removeFromCart(key) {
  cart = cart.filter((item) => cartKey(item) !== key);
  saveCart();
  renderCart();
}

function openCart() {
  cartDrawer.classList.add('open');
  cartDrawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('cart-open');
}

function closeCart() {
  cartDrawer.classList.remove('open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('cart-open');
}

function openModal(modal) {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeModal(modal) {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (![previewModal, contactModal, refundModal].some((item) => item.classList.contains('open'))) {
    document.body.classList.remove('modal-open');
  }
}

function openPreview(id) {
  const product = getProduct(id);
  if (!product) return;
  activePreviewId = id;
  previewImage.src = product.image;
  previewImage.alt = product.name;
  previewTag.textContent = product.tag;
  previewTitle.textContent = product.name;
  previewDesc.textContent = product.description;
  previewPrice.innerHTML = '';
  previewSelectors.innerHTML = '';
  previewSelectors.style.display = 'none';
  openModal(previewModal);
}

async function createRazorpayOrder(customer) {
  const response = await fetch('/api/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: cart.map((item) => ({
        id: item.id,
        brand: item.brand,
        model: item.model,
        qty: item.qty
      })),
      customer
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not create Razorpay order.');
  }
  return data;
}

async function getRazorpayKey() {
  const response = await fetch('/api/razorpay-key');
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Razorpay key is not configured.');
  }
  return data.key;
}

async function verifyPayment(paymentResponse) {
  const response = await fetch('/api/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentResponse)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Payment verification failed.');
  }
  return data;
}

function setStatus(message, type = '') {
  checkoutStatus.textContent = message;
  checkoutStatus.className = `form-note ${type}`.trim();
}

async function handleCheckout(event) {
  event.preventDefault();
  if (cart.length === 0) {
    setStatus('Please add a product to cart first.', 'error');
    return;
  }

  if (cart.some((item) => !item.brand || !item.model)) {
    setStatus('Please select mobile brand and model for every product before checkout.', 'error');
    return;
  }

  const formData = new FormData(checkoutForm);
  const customer = {
    name: String(formData.get('name') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    mobile: String(formData.get('mobile') || '').replace(/\D/g, '').slice(0, 10),
    pincode: String(formData.get('pincode') || '').replace(/\D/g, '').slice(0, 6),
    address: String(formData.get('address') || '').trim()
  };

  if (!/^\d{10}$/.test(customer.mobile)) {
    setStatus('Please enter exactly 10 digits in mobile number.', 'error');
    return;
  }

  if (!/^\d{6}$/.test(customer.pincode)) {
    setStatus('Please enter exactly 6 digits in pin code.', 'error');
    return;
  }

  try {
    checkoutBtn.disabled = true;
    setStatus('Creating secure Razorpay order...');

    if (!window.Razorpay) {
      throw new Error('Razorpay checkout script did not load. Check your internet connection.');
    }

    const [key, order] = await Promise.all([getRazorpayKey(), createRazorpayOrder(customer)]);
    setStatus('Opening Razorpay checkout...');

    const options = {
      key,
      amount: order.amount,
      currency: order.currency,
      name: 'RoyalWraps',
      description: order.items.map((item) => `${item.name} (${item.brand} ${item.model}) x ${item.qty}`).join(', '),
      order_id: order.orderId,
      prefill: {
        name: customer.name,
        email: customer.email,
        contact: customer.mobile
      },
      notes: {
        address: customer.address,
        pincode: customer.pincode,
        mobile_model: order.items.map((item) => `${item.brand} ${item.model}`).join(', ')
      },
      theme: {
        color: '#d6a247'
      },
      handler: async function (response) {
        try {
          await verifyPayment(response);
          setStatus(`Payment successful. Payment ID: ${response.razorpay_payment_id}`, 'success');
          cart = [];
          saveCart();
          renderCart();
          checkoutForm.reset();
        } catch (error) {
          setStatus(error.message, 'error');
        } finally {
          checkoutBtn.disabled = false;
        }
      },
      modal: {
        ondismiss: function () {
          setStatus('Checkout closed. Your cart is still saved.');
          checkoutBtn.disabled = false;
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  } catch (error) {
    setStatus(error.message, 'error');
    checkoutBtn.disabled = false;
  }
}

productGrid.addEventListener('change', (event) => {
  const brandSelect = event.target.closest('.mobile-brand-select');
  const modelSelect = event.target.closest('.mobile-model-select');

  if (brandSelect) updateModelSelect(brandSelect);
  if (modelSelect) updateCustomModelField(modelSelect);

  const selectorGroup = event.target.closest('.phone-selectors[data-selector-group="card"]');

  if (selectorGroup) {
    maybeReturnToCustomizeAfterSelection(selectorGroup);
  }
});
productGrid.addEventListener('input', (event) => {
  const customInput = event.target.closest('.custom-model-input');
  if (!customInput) return;

  const selectorGroup = customInput.closest('.phone-selectors[data-selector-group="card"]');

  if (selectorGroup) {
    maybeReturnToCustomizeAfterSelection(selectorGroup);
  }
});

previewModal.addEventListener('change', (event) => {
  const brandSelect = event.target.closest('.mobile-brand-select');
  const modelSelect = event.target.closest('.mobile-model-select');
  if (brandSelect) updateModelSelect(brandSelect);
  if (modelSelect) updateCustomModelField(modelSelect);
});

productGrid.addEventListener('click', (event) => {
  const addButton = event.target.closest('[data-add]');
  const customizeButton = event.target.closest('[data-customize]');

  if (addButton) {
    const selection = getSelectionForProduct(addButton.dataset.add);
    addToCart(addButton.dataset.add, selection);
    if (selection.brand && selection.model) openCart();
  }

if (customizeButton) {
  const selection = getSelectionForProduct(customizeButton.dataset.customize);
  const brand = String(selection.brand || '').trim();
  const model = String(selection.model || '').trim();

  if (!brand || !model) {
    if (selection.selectedModel === OTHER_MODEL_VALUE && !selection.customModel) {
      alert('Please enter the exact Mobile Model name.');
    } else {
      alert('Please select Mobile Brand and Mobile Model before customizing this skin.');
    }
    return;
  }

  const validModels = phoneModels[brand] || [];
  const customModelSelected =
    model.startsWith('Other: ') && model.replace('Other: ', '').trim().length >= 2;

  if (!validModels.includes(model) && !customModelSelected) {
    alert('Please select a valid Mobile Model for the selected brand.');
    return;
  }

  pendingCustomizeSelection = {
    brand,
    model,
    selectedProductId: customizeButton.dataset.customize
  };

  document.getElementById('customize')?.scrollIntoView({
    behavior: 'smooth'
  });
}
});

cartItems.addEventListener('click', (event) => {
  const incButton = event.target.closest('[data-inc]');
  const decButton = event.target.closest('[data-dec]');
  const removeButton = event.target.closest('[data-remove]');

  if (incButton) changeQuantity(incButton.dataset.inc, 1);
  if (decButton) changeQuantity(decButton.dataset.dec, -1);
  if (removeButton) removeFromCart(removeButton.dataset.remove);
});

if (previewAddBtn) {
  previewAddBtn.addEventListener('click', () => {
    if (activePreviewId) {
      const selection = getSelectionForProduct(activePreviewId);
      addToCart(activePreviewId, selection);
      if (selection.brand && selection.model) {
        closeModal(previewModal);
        openCart();
      }
    }
  });
}

openCartBtn.addEventListener('click', openCart);
closeCartBtn.addEventListener('click', closeCart);

checkoutForm.querySelectorAll('input[name="mobile"], input[name="pincode"]').forEach((input) => {
  input.addEventListener('input', () => {
    const maxLength = Number(input.getAttribute('maxlength')) || 10;
    input.value = input.value.replace(/\D/g, '').slice(0, maxLength);
  });

  input.addEventListener('paste', (event) => {
    event.preventDefault();
    const maxLength = Number(input.getAttribute('maxlength')) || 10;
    const pastedDigits = (event.clipboardData || window.clipboardData)
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, maxLength);
    input.value = pastedDigits;
  });
});

checkoutForm.addEventListener('submit', handleCheckout);

document.querySelectorAll('[data-open-contact]').forEach((button) => {
  button.addEventListener('click', () => openModal(contactModal));
});

document.querySelectorAll('[data-open-refund]').forEach((button) => {
  button.addEventListener('click', () => openModal(refundModal));
});

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => closeModal(button.closest('.modal')));
});

[previewModal, contactModal, refundModal].forEach((modal) => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal(modal);
  });
});

cartDrawer.addEventListener('click', (event) => {
  if (event.target === cartDrawer) closeCart();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeCart();
    [previewModal, contactModal, refundModal].forEach(closeModal);
  }
});
const customizeForm = document.getElementById('customizeForm');
const customizeStatus = document.getElementById('customizeStatus');

async function handleCustomizeSubmit(event) {
  event.preventDefault();
if (!pendingCustomizeSelection?.brand || !pendingCustomizeSelection?.model) {
  returnToCustomizeAfterModelSelection = true;
  customizeStatus.textContent = 'Please select Mobile Brand and Mobile Model from any product before uploading photo.';
  customizeStatus.className = 'customize-status error';

  document.getElementById('products')?.scrollIntoView({
    behavior: 'smooth'
  });

  return;
}
  customizeStatus.textContent = 'Uploading your photo...';
  customizeStatus.className = 'customize-status';

  try {
    const formData = new FormData(customizeForm);

    const response = await fetch('/api/customize-order', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Photo upload failed.');
    }
    customizeStatus.textContent = 'Photo uploaded successfully';
    customizeStatus.classList.add('success');
    addCustomUploadToCart(data.imageUrl, pendingCustomizeSelection);
    customizeForm.reset();
  } catch (error) {
    customizeStatus.textContent = error.message;
    customizeStatus.classList.add('error');
  }
}

if (customizeForm) {
  customizeForm.addEventListener('submit', handleCustomizeSubmit);
}
renderProducts();
renderCart();
