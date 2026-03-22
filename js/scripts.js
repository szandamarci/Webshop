const pageHistory = ['index'];

function navigateBackPage(fallbackPage = 'index') {
  if (pageHistory.length > 1) {
    pageHistory.pop();
    const previousPage = pageHistory[pageHistory.length - 1];
    loadPage(previousPage, { skipHistory: true });
    return;
  }

  loadPage(fallbackPage, { skipHistory: true });
}

async function loadPage(page, options = {}) {
  const skipHistory = Boolean(options?.skipHistory);
  if (!skipHistory) {
    const lastPage = pageHistory[pageHistory.length - 1];
    if (lastPage !== page) {
      pageHistory.push(page);
    }
  }

  if (page === "about") {
    const content = document.getElementById("content");
    const response = await fetch(`${page}.html`);
    if (!response.ok) throw new Error('Page not found');
    const html = await response.text();
    content.innerHTML = html;
  }

  if (page === "contact") {
    const content = document.getElementById("content");
    const response = await fetch(`${page}.html`);
    if (!response.ok) throw new Error('Page not found');
    const html = await response.text();
    content.innerHTML = html;
  }

  if (page === "privacy") {
    const content = document.getElementById("content");
    const response = await fetch(`${page}.html`);
    if (!response.ok) throw new Error('Page not found');
    const html = await response.text();
    content.innerHTML = html;
  }

  if (page === "terms") {
    const content = document.getElementById("content");
    const response = await fetch(`${page}.html`);
    if (!response.ok) throw new Error('Page not found');
    const html = await response.text();
    content.innerHTML = html;
  }

  if (page === "index") {
    const content = document.getElementById("webshop-content");
    const response = await fetch(`${page}.html`);
    if (!response.ok) throw new Error('Page not found');
    const html = await response.text();
    content.innerHTML = html;
    renderProducts(selectedCategory);
  }

  if (page === "cart") {
    const content = document.getElementById("content");
    const response = await fetch(`${page}.html`);
    if (!response.ok) throw new Error('Page not found');
    const html = await response.text();
    content.innerHTML = html;
  }

  if (page === "login") {
    const content = document.getElementById("content");
    const response = await fetch(`${page}.html`);
    if (!response.ok) throw new Error('Page not found');
    const html = await response.text();
    content.innerHTML = html;
  }

  if (page === "register") {
    const content = document.getElementById("content");
    const response = await fetch(`${page}.html`);
    if (!response.ok) throw new Error('Page not found');
    const html = await response.text();
    content.innerHTML = html;
  }
  if (page === "register_done") {
    const content = document.getElementById("content");
    const response = await fetch(`${page}.html`);
    if (!response.ok) throw new Error('Page not found');
    const html = await response.text();
    content.innerHTML = html;
  }
  if (page === "payment") {
    const content = document.getElementById("content");
    const response = await fetch(`${page}.html`);
    if (!response.ok) throw new Error('Page not found');
    const html = await response.text();
    content.innerHTML = html;
  }
  if (page === "admin") {
    const user = getCurrentUser();
    if (!user || !user.isAdmin) {
      alert('Ehhez az oldalhoz admin jogosultság szükséges.');
      loadPage('index');
      return;
    }

    const content = document.getElementById("content");
    const response = await fetch(`${page}.html`);
    if (!response.ok) throw new Error('Page not found');
    const html = await response.text();
    content.innerHTML = html;
    initAdminPage();
  }
  // Rediscover buttons if we dynamically replaced content.
  initCartEvents();
  updateCartBadge();  
  renderCartItems();
  updateAuthNav();
  updateProductCartUI();
  initMainSearchEvents();
  initSidebarPriceFilter();
  initPaymentPage();
}

let selectedCategory = null;
const SIDEBAR_PRICE_MAX = 10000000;
let selectedPriceMin = 0;
let selectedPriceMax = SIDEBAR_PRICE_MAX;
let selectedSaleOnly = false;

function normalizeCategory(category) {
  if (!category || category === 'all') return null;
  return category;
}

async function filterProductsByCategory(category) {
  selectedCategory = normalizeCategory(category);
  selectedSaleOnly = false;

  const hasProductsGrid = !!document.getElementById('dynamic-products-grid');
  if (!hasProductsGrid) {
    await loadPage('index');
    return;
  }

  renderProducts(selectedCategory);
}

async function filterProductsOnSale() {
  selectedCategory = null;
  selectedSaleOnly = true;

  const hasProductsGrid = !!document.getElementById('dynamic-products-grid');
  if (!hasProductsGrid) {
    await loadPage('index');
    return;
  }

  renderProducts(selectedCategory);
}

function getCurrentUser() {
  const raw = localStorage.getItem('currentUser');
  return raw ? JSON.parse(raw) : null;
}

function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
  updateAuthNav();
}

function clearCurrentUser() {
  localStorage.removeItem('currentUser');
  updateAuthNav();
}

function updateAuthNav() {
  const user = getCurrentUser();
  const loginItem = document.getElementById('nav-login');
  const registerItem = document.getElementById('nav-register');
  const adminItem = document.getElementById('nav-admin');
  const userItem = document.getElementById('nav-user');
  const userLabel = document.getElementById('user-display');

  if (user) {
    if (loginItem) loginItem.style.display = 'none';
    if (registerItem) registerItem.style.display = 'none';
    if (adminItem) adminItem.style.display = user.isAdmin ? 'block' : 'none';
    if (userItem) userItem.style.display = 'flex';
    if (userLabel) userLabel.textContent = `${user.firstName} ${user.lastName}`.trim();
  } else {
    if (loginItem) loginItem.style.display = 'block';
    if (registerItem) registerItem.style.display = 'block';
    if (adminItem) adminItem.style.display = 'none';
    if (userItem) userItem.style.display = 'none';
    if (userLabel) userLabel.textContent = '';
  }
}

function logout() {
  clearCurrentUser();
  loadPage('index');
}

async function renderProducts(category = null) {
  const container = document.getElementById('dynamic-products-grid');
  const staticRow = document.getElementById('static-products-row');

  if (!container) return;
  if (staticRow) staticRow.style.display = 'none';

  container.innerHTML = '<div class="col-12 text-center py-5">Termékek betöltése...</div>';

  try {
    const normalized = normalizeCategory(category);
    const endpoint = normalized
      ? `http://localhost:5000/products?category=${encodeURIComponent(normalized)}`
      : 'http://localhost:5000/products';

    const res = await fetch(endpoint);
    if (!res.ok) {
      container.innerHTML = '<div class="col-12 text-center text-danger py-5">Nem sikerült betölteni a termékeket.</div>';
      return;
    }

    const result = await res.json();
    const products = (result && result.products) || [];
    const filteredProducts = selectedSaleOnly
      ? products.filter((prod) => Boolean(prod.prod_sale))
      : products;

    if (!filteredProducts.length) {
      container.innerHTML = '<div class="col-12 text-center py-5">Nincsenek elérhető termékek.</div>';
      return;
    }

    container.innerHTML = filteredProducts.map(prod => {
      const imageUrl = prod.prod_image || 'https://dummyimage.com/450x300/dee2e6/6c757d.jpg';
      const price = prod.prod_price ? parseFloat(prod.prod_price) : 0;
      const isSale = Boolean(prod.prod_sale);
      const priceDisplay = price ? price.toFixed(2) + ' Ft' : 'Nincs ár';
      return `
        <div class="col mb-5">
          <div class="card h-100">
            ${isSale ? '<div class="badge bg-dark text-white position-absolute" style="top: 0.5rem; right: 0.5rem">Sale</div>' : ''}
            <img class="card-img-top" src="${imageUrl}" alt="${prod.prod_name}">
            <div class="card-body p-4">
              <div class="text-center">
                <h5 class="fw-bolder">${prod.prod_name}</h5>
                <p class="mb-0">${priceDisplay}</p>
              </div>
            </div>
            <div class="card-footer p-4 pt-0 border-top-0 bg-transparent">
              <div class="text-center"><a class="btn btn-outline-dark mt-auto add-to-cart" href="#" data-item="${encodeURIComponent(prod.prod_name)}" data-price="${price}">Add to cart</a></div>
            </div>
          </div>
        </div>`;
    }).join('');

    initCartEvents();
  } catch (error) {
    container.innerHTML = `<div class="col-12 text-center text-danger py-5">Hiba történt: ${error.message}</div>`;
  }

  updateProductCartUI();
  searchProducts();
}

function searchProducts() {
  const query = document.getElementById('search')?.value.trim().toLowerCase() || '';
  const productCols = document.querySelectorAll('#dynamic-products-grid .col, #static-products-row .col');
  if (!productCols.length) return;

  productCols.forEach(col => {
    const title = col.querySelector('.card-body h5')?.textContent?.toLowerCase() || '';
    const priceText = col.querySelector('.card-body p')?.textContent?.toLowerCase() || '';
    const alt = col.querySelector('.card-img-top')?.alt?.toLowerCase() || '';
    const content = `${title} ${priceText} ${alt}`;
    const productPrice = getProductPriceFromCard(col);
    const matchesPrice = productPrice >= selectedPriceMin && productPrice <= selectedPriceMax;

    if ((!query || content.includes(query)) && matchesPrice) {
      col.style.display = '';
    } else {
      col.style.display = 'none';
    }
  });
}

function getProductPriceFromCard(cardCol) {
  const priceText = cardCol?.querySelector('.card-body p')?.textContent || '';
  let normalizedText = priceText.replace(/[^\d.,-]/g, '');
  if (!normalizedText) return 0;

  if (normalizedText.includes(',') && normalizedText.includes('.')) {
    normalizedText = normalizedText.replace(/\./g, '').replace(',', '.');
  } else if (normalizedText.includes(',')) {
    normalizedText = normalizedText.replace(',', '.');
  }

  const parsed = Number(normalizedText);
  return Number.isFinite(parsed) ? parsed : 0;
}

function updateSidebarPriceLabel() {
  const label = document.getElementById('sidebar-price-value');
  if (!label) return;
  label.textContent = `${selectedPriceMin.toLocaleString('hu-HU')} Ft - ${selectedPriceMax.toLocaleString('hu-HU')} Ft`;
}

function normalizeSidebarPriceValue(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(SIDEBAR_PRICE_MAX, Math.max(0, parsed));
}

function initSidebarPriceFilter() {
  const minInput = document.getElementById('sidebar-price-min');
  const maxInput = document.getElementById('sidebar-price-max');
  if (!minInput || !maxInput) return;

  minInput.min = '0';
  minInput.max = String(SIDEBAR_PRICE_MAX);
  minInput.step = '1000';
  minInput.value = String(selectedPriceMin);

  maxInput.min = '0';
  maxInput.max = String(SIDEBAR_PRICE_MAX);
  maxInput.step = '1000';
  maxInput.value = String(selectedPriceMax);

  minInput.oninput = (event) => {
    selectedPriceMin = normalizeSidebarPriceValue(event.target.value, 0);

    if (selectedPriceMin > selectedPriceMax) {
      selectedPriceMax = selectedPriceMin;
      maxInput.value = String(selectedPriceMax);
    }

    event.target.value = String(selectedPriceMin);

    updateSidebarPriceLabel();
    searchProducts();
  };

  maxInput.oninput = (event) => {
    selectedPriceMax = normalizeSidebarPriceValue(event.target.value, SIDEBAR_PRICE_MAX);

    if (selectedPriceMax < selectedPriceMin) {
      selectedPriceMin = selectedPriceMax;
      minInput.value = String(selectedPriceMin);
    }

    event.target.value = String(selectedPriceMax);

    updateSidebarPriceLabel();
    searchProducts();
  };

  updateSidebarPriceLabel();
}

function initMainSearchEvents() {
  const searchInput = document.getElementById('search');
  if (!searchInput) return;

  searchInput.removeEventListener('input', searchProducts);
  searchInput.addEventListener('input', searchProducts);
}


const CART_KEY = 'webshopCart';

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    return JSON.parse(raw);    
  } catch (e) {
    console.error('Cart parse error', e);
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
}

let cartItems = loadCart();
let cartCount = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

function updateCartBadge() {
  const badge = document.getElementById("cart-count");
  if (!badge) return;
  cartCount = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  badge.textContent = String(cartCount);
}

function renderCartItems() {
  const container = document.getElementById('cart-items-container');
  const template = document.getElementById('cart-item-template');
  if (!container || !template) return;

  container.innerHTML = '';

  if (cartItems.length === 0) {
    container.innerHTML = '<div>Nincs termék a kosárban.</div>';
    const tot = document.getElementById('total-price');
    if (tot) tot.textContent = '0 Ft';
    return;
  }

  let totalPrice = 0;

  cartItems.forEach(item => {
    const qty = item.quantity || 1;
    const price = Number(item.price || 0);
    const itemTotal = qty * price;
    totalPrice += itemTotal;

    const clone = template.content.cloneNode(true);
    const itemRow = clone.querySelector('.cart-item-row');
    const qtySpan = clone.querySelector('.cart-item-qty');
    const details = clone.querySelector('.cart-item-details');
    const decBtn = clone.querySelector('.decrement-cart-item');
    const incBtn = clone.querySelector('.increment-cart-item');

    if (qtySpan) qtySpan.textContent = String(qty);
    if (details) details.innerHTML = `<strong>${item.name}</strong> - ${qty} x ${price.toFixed(2)} Ft = ${itemTotal.toFixed(2)} Ft`;

    if (decBtn) {
      decBtn.addEventListener('click', (event) => {
        event.preventDefault();
        addToCart(-1, item.name, price);
      });
    }
    if (incBtn) {
      incBtn.addEventListener('click', (event) => {
        event.preventDefault();
        addToCart(1, item.name, price);
      });
    }

    container.appendChild(clone);
  });

  const total = document.getElementById('total-price');
  if (total) total.textContent = `${totalPrice.toFixed(2)} Ft`;

  saveCart();
  updateCartBadge();
  updateProductCartUI();
}

function getPaymentStatusElement() {
  return document.getElementById('payment-status');
}

function showPaymentStatus(message, isError = false) {
  const status = getPaymentStatusElement();
  if (!status) return;

  status.textContent = message;
  status.className = isError ? 'mt-3 text-danger' : 'mt-3 text-success';
}

function hasAcceptedLegalCheckboxes() {
  const readTerms = document.getElementById('read-terms-and-conditions');
  const readPrivacy = document.getElementById('read-privacy-policy');
  return Boolean(readTerms?.checked && readPrivacy?.checked);
}

function updatePaymentButtonsState() {
  const barionButton = document.getElementById('pay-barion');
  const simplePayButton = document.getElementById('pay-simplepay');
  const isAccepted = hasAcceptedLegalCheckboxes();

  if (barionButton) barionButton.disabled = !isAccepted;
  if (simplePayButton) simplePayButton.disabled = !isAccepted;
}

function collectBillingFormData() {
  const requiredFields = [
    ['billing-email', 'email'],
    ['billing-phone', 'phone'],
    ['billing-first-name', 'firstName'],
    ['billing-last-name', 'lastName'],
    ['billing-address', 'address'],
    ['billing-city', 'city'],
    ['billing-zip', 'zip'],
    ['billing-country', 'country']
  ];

  const billing = {};
  for (const [id, key] of requiredFields) {
    const input = document.getElementById(id);
    const value = input ? input.value.trim() : '';
    if (!value) {
      showPaymentStatus('Kérlek tölts ki minden számlázási mezőt.', true);
      if (input) input.focus();
      return null;
    }
    billing[key] = value;
  }

  return billing;
}

function renderPaymentSummary() {
  const info = document.getElementById('billing-info');
  if (!info) return;

  const items = cartItems || [];
  const total = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);

  if (!items.length) {
    info.innerHTML = '<div class="alert alert-warning">A kosár üres. Előbb adj termékeket a kosárhoz.</div>';
    return;
  }

  const list = items
    .map((item) => `<li>${escapeHtml(item.name)} - ${Number(item.quantity || 1)} x ${Number(item.price || 0).toFixed(2)} Ft</li>`)
    .join('');

  info.innerHTML = `
    <div class="alert alert-light border">
      <strong>Rendelés összesítő</strong>
      <ul class="mb-2 mt-2">${list}</ul>
      <div><strong>Fizetendő:</strong> ${total.toFixed(2)} Ft</div>
    </div>
  `;
}

async function startBarionCheckout() {
  if (!hasAcceptedLegalCheckboxes()) {
    showPaymentStatus('A fizetéshez fogadd el az ÁSZF-et és az Adatvédelmi Szabályzatot.', true);
    updatePaymentButtonsState();
    return;
  }

  if (!cartItems.length) {
    showPaymentStatus('A kosár üres, nem indítható fizetés.', true);
    return;
  }

  const billing = collectBillingFormData();
  if (!billing) return;

  const button = document.getElementById('pay-barion');
  if (button) button.disabled = true;
  showPaymentStatus('Barion fizetés indítása...');

  const payload = {
    items: cartItems,
    billing,
    redirectOrigin: window.location.origin
  };

  try {
    const res = await fetch('http://localhost:5000/create-payment/barion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok || !result.success || !result.url) {
      const apiError = result?.error || 'A Barion fizetés indítása sikertelen.';
      showPaymentStatus(apiError, true);
      return;
    }

    window.location.href = result.url;
  } catch (error) {
    showPaymentStatus(`Hálózati hiba: ${error.message}`, true);
  } finally {
    if (button) button.disabled = false;
    updatePaymentButtonsState();
  }
}

function startSimplePayCheckout(event) {
  if (event) event.preventDefault();

  if (!hasAcceptedLegalCheckboxes()) {
    showPaymentStatus('A fizetéshez fogadd el az ÁSZF-et és az Adatvédelmi Szabályzatot.', true);
    updatePaymentButtonsState();
    return;
  }

  showPaymentStatus('A SimplePay fizetés hamarosan elérhető lesz.', true);
}

async function resolveBarionReturn() {
  const params = new URLSearchParams(window.location.search);
  const provider = (params.get('provider') || '').toLowerCase();
  const paymentId = params.get('paymentId') || params.get('PaymentId') || '';

  if (provider !== 'barion' || !paymentId) return;

  showPaymentStatus('Fizetés állapotának ellenőrzése...');

  try {
    const res = await fetch(`http://localhost:5000/payment/state/barion/${encodeURIComponent(paymentId)}`);
    const result = await res.json();

    if (!res.ok || !result.success) {
      showPaymentStatus('Nem sikerült lekérni a fizetés állapotát.', true);
      return;
    }

    const status = (result.state?.Status || '').toLowerCase();
    if (status === 'succeeded') {
      cartItems = [];
      saveCart();
      updateCartBadge();
      renderCartItems();
      renderPaymentSummary();
      showPaymentStatus('A fizetés sikeres volt. Köszönjük a rendelést!');
      return;
    }

    if (status === 'canceled' || status === 'failed') {
      showPaymentStatus('A fizetés nem sikerült vagy megszakadt. Próbáld újra.', true);
      return;
    }

    showPaymentStatus(`Fizetés státusz: ${result.state?.Status || 'ismeretlen'}`, true);
  } catch (error) {
    showPaymentStatus(`Hiba az állapot lekérdezésekor: ${error.message}`, true);
  }
}

async function fillBillingFromCurrentUser() {
  const user = getCurrentUser();
  if (!user?.email) return;

  try {
    const res = await fetch(`http://localhost:5000/users/profile?email=${encodeURIComponent(user.email)}`);
    const result = await res.json();
    if (!res.ok || !result.success || !result.user) return;

    const billingEmail = document.getElementById('billing-email');
    const billingLastName = document.getElementById('billing-first-name');
    const billingFirstName = document.getElementById('billing-last-name');

    if (billingEmail && !billingEmail.value.trim()) {
      billingEmail.value = result.user.email || '';
    }

    // Map DB names to field labels: Vezeteknev -> user.lastName, Keresztnev -> user.firstName.
    if (billingLastName && !billingLastName.value.trim()) {
      billingLastName.value = result.user.lastName || '';
    }

    if (billingFirstName && !billingFirstName.value.trim()) {
      billingFirstName.value = result.user.firstName || '';
    }
  } catch (error) {
    console.error('Billing autofill failed:', error);
  }
}

function initPaymentPage() {
  const barionButton = document.getElementById('pay-barion');
  const simplePayButton = document.getElementById('pay-simplepay');
  if (!barionButton) return;

  barionButton.removeEventListener('click', startBarionCheckout);
  barionButton.addEventListener('click', startBarionCheckout);

  if (simplePayButton) {
    simplePayButton.removeEventListener('click', startSimplePayCheckout);
    simplePayButton.addEventListener('click', startSimplePayCheckout);
  }

  const readTerms = document.getElementById('read-terms-and-conditions');
  const readPrivacy = document.getElementById('read-privacy-policy');

  if (readTerms) {
    readTerms.removeEventListener('change', updatePaymentButtonsState);
    readTerms.addEventListener('change', updatePaymentButtonsState);
  }

  if (readPrivacy) {
    readPrivacy.removeEventListener('change', updatePaymentButtonsState);
    readPrivacy.addEventListener('change', updatePaymentButtonsState);
  }

  updatePaymentButtonsState();

  renderPaymentSummary();
  resolveBarionReturn();
  fillBillingFromCurrentUser();
}

function getCartItem(name, price) {
  return cartItems.find(i => i.name === name && Number(i.price) === Number(price));
}

function getCartQuantity(name, price) {
  const item = getCartItem(name, price);
  return item ? (item.quantity || 0) : 0;
}

function removeFromCart(itemName, itemPrice) {
  cartItems = cartItems.filter(i => !(i.name === itemName && Number(i.price) === Number(itemPrice)));
  saveCart();
  updateCartBadge();
  renderCartItems();
  updateProductCartUI();
}

function updateProductCartUI() {
  document.querySelectorAll('.card').forEach(card => {
    const title = card.querySelector('.card-body h5');
    if (!title) return;

    const itemName = title.textContent.trim();
    let itemPrice = 0;

    const priceEl = card.querySelector('.card-body p');
    if (priceEl) {
      const numberText = priceEl.textContent.replace(/[\$Ft\s,]/g, '').replace(',', '.');
      itemPrice = Number(numberText) || 0;
    }

    const quantity = getCartQuantity(itemName, itemPrice);
    const footer = card.querySelector('.card-footer');
    if (!footer) return;

    if (quantity > 0) {
      footer.innerHTML = `
        <div class="d-flex justify-content-center align-items-center">
          <button class="btn btn-sm btn-outline-secondary me-2 decrement-btn">-</button>
          <span class="fw-bold">${quantity}</span>
          <button class="btn btn-sm btn-outline-secondary ms-2 increment-btn">+</button>
        </div>`;
      const decBtn = footer.querySelector('.decrement-btn');
      const incBtn = footer.querySelector('.increment-btn');
      decBtn.addEventListener('click', () => {
        addToCart(-1, itemName, itemPrice);
      });
      incBtn.addEventListener('click', () => {
        addToCart(1, itemName, itemPrice);
      });
    } else {
      footer.innerHTML = `<div class="text-center"><a class="btn btn-outline-dark mt-auto add-to-cart" href="#" data-item="${encodeURIComponent(itemName)}" data-price="${itemPrice}">Add to cart</a></div>`;
      const addBtn = footer.querySelector('.add-to-cart');
      if (addBtn) {
        addBtn.addEventListener('click', handleAddToCart);
      }
    }
  });
}

function addToCart(amount = 1, itemName = null, itemPrice = 0) {
  if (!itemName) return;
  const normalizedName = itemName.trim();
  const price = Number(itemPrice) || 0;

  const existing = cartItems.find(i => i.name === normalizedName && Number(i.price) === price);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + amount;
    if (existing.quantity <= 0) {
      cartItems = cartItems.filter(i => !(i.name === normalizedName && Number(i.price) === price));
    }
  } else if (amount > 0) {
    cartItems.push({ name: normalizedName, price, quantity: amount });
  }

  saveCart();
  updateCartBadge();
  renderCartItems();
  updateProductCartUI();
}

function initCartEvents() {
  document.querySelectorAll(".add-to-cart").forEach(btn => {
    btn.removeEventListener("click", handleAddToCart);
    btn.addEventListener("click", handleAddToCart);
  });

const forwardButton = document.getElementById('forward-to-payment');
  if (forwardButton) {
    forwardButton.onclick = (event) => {
      event.preventDefault();
      loadPage('payment');
    };
  }
}

function handleAddToCart(event) {
  event.preventDefault();

  const btn = event.currentTarget;
  let itemName = btn.dataset.item ? decodeURIComponent(btn.dataset.item) : null;
  let itemPrice = Number(btn.dataset.price || 0);

  if (!itemName) {
    const card = btn.closest(".card");
    if (card) {
      const title = card.querySelector(".card-body h5");
      if (title) itemName = title.textContent.trim();

      if (!itemPrice) {
        const priceEl = card.querySelector('.card-body p');
        if (priceEl) {
          const priceText = priceEl.textContent.replace(/[\$Ft\s]/g, '').replace(',', '.');
          itemPrice = Number(priceText) || 0;
        }
      }
    }
  }

  addToCart(1, itemName, itemPrice);
}

function getRequesterEmailForAdmin() {
  const user = getCurrentUser();
  return user && user.email ? user.email : '';
}

function showAdminTableMessage(text, isError = false) {
  const el = document.getElementById('admin-table-message');
  if (!el) return;
  el.textContent = text;
  el.className = isError ? 'small text-danger' : 'small text-success';
}

function showAdminAddMessage(text, isError = false) {
  const el = document.getElementById('admin-add-message');
  if (!el) return;
  el.textContent = text;
  el.className = isError ? 'small text-danger' : 'small text-success';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getImageFileName(imagePath) {
  const raw = String(imagePath || '').trim();
  if (!raw) return '';

  const withoutQuery = raw.split('?')[0].split('#')[0];
  const segments = withoutQuery.split(/[\\/]/);
  return segments[segments.length - 1] || '';
}

let adminProductsCache = [];

function renderAdminProductsTable(products) {
  const body = document.getElementById('admin-products-table-body');
  if (!body) return;

  if (!products.length) {
    body.innerHTML = '<tr><td colspan="7" class="text-center py-4">Nincs találat.</td></tr>';
    return;
  }

  body.innerHTML = products.map((prod) => {
    const id = Number(prod.prod_id || 0);
    const price = Number(prod.prod_price || 0);
    const category = prod.prod_category || '';
    const name = prod.prod_name || '';
    const image = prod.prod_image || '';
    const sale = Boolean(prod.prod_sale);
    const imageFileName = getImageFileName(image);

    return `
      <tr>
        <td>${id || '-'}</td>
        <td style="min-width: 220px;">
          <input type="text" class="form-control form-control-sm" id="admin-name-${id}" value="${escapeHtml(name)}" ${id ? '' : 'disabled'}>
        </td>
        <td style="min-width: 160px;">
          <input type="text" class="form-control form-control-sm" id="admin-category-${id}" value="${escapeHtml(category)}" ${id ? '' : 'disabled'}>
        </td>
        <td style="min-width: 220px;">
          <input type="text" class="form-control form-control-sm" id="admin-image-${id}" value="${escapeHtml(imageFileName)}" ${id ? '' : 'disabled'}>
        </td>
        <td style="max-width: 150px;">
          <input type="number" step="0.01" min="0" class="form-control form-control-sm" id="admin-price-${id}" value="${price.toFixed(2)}" ${id ? '' : 'disabled'}>
        </td>
        <td style="min-width: 160px;">
          <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" name="admin-sale-${id}" id="admin-sale-no-${id}" value="0" ${sale ? '' : 'checked'} ${id ? '' : 'disabled'}>
            <label class="form-check-label" for="admin-sale-no-${id}">Nem</label>
          </div>
          <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" name="admin-sale-${id}" id="admin-sale-yes-${id}" value="1" ${sale ? 'checked' : ''} ${id ? '' : 'disabled'}>
            <label class="form-check-label" for="admin-sale-yes-${id}">Igen</label>
          </div>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-2" onclick="updateAdminProduct(${id})" ${id ? '' : 'disabled'}>Mentés</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteAdminProduct(${id})" ${id ? '' : 'disabled'}>Törlés</button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterAdminProductsList() {
  const searchInput = document.getElementById('admin-product-search');
  const query = (searchInput?.value || '').trim().toLowerCase();

  if (!query) {
    renderAdminProductsTable(adminProductsCache);
    return;
  }

  const filtered = adminProductsCache.filter((prod) => {
    const name = (prod.prod_name || '').toLowerCase();
    const category = (prod.prod_category || '').toLowerCase();
    return name.includes(query) || category.includes(query);
  });

  renderAdminProductsTable(filtered);
}

async function loadAdminProducts() {
  const body = document.getElementById('admin-products-table-body');
  if (!body) return;

  body.innerHTML = '<tr><td colspan="7" class="text-center py-4">Termékek betöltése...</td></tr>';

  try {
    const res = await fetch('http://localhost:5000/products');
    const result = await res.json();

    if (!res.ok || !result.success) {
      body.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Nem sikerült betölteni a termékeket.</td></tr>';
      return;
    }

    adminProductsCache = result.products || [];
    if (!adminProductsCache.length) {
      body.innerHTML = '<tr><td colspan="7" class="text-center py-4">Nincsenek termékek.</td></tr>';
      return;
    }

    filterAdminProductsList();
  } catch (error) {
    body.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Hiba: ${error.message}</td></tr>`;
  }
}

async function handleAdminAddProduct(event) {
  event.preventDefault();

  const name = document.getElementById('admin-prod-name')?.value.trim() || '';
  const price = document.getElementById('admin-prod-price')?.value;
  const category = document.getElementById('admin-prod-category')?.value.trim() || '';
  const image = document.getElementById('admin-prod-image')?.value.trim() || '';
  const saleValue = document.querySelector('input[name="admin-prod-sale"]:checked')?.value || '0';
  const sale = saleValue === '1';
  const requesterEmail = getRequesterEmailForAdmin();

  if (!name || price === '') {
    showAdminAddMessage('A név és ár megadása kötelező.', true);
    return;
  }

  try {
    const res = await fetch('http://localhost:5000/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requester_email: requesterEmail,
        prod_name: name,
        prod_price: Number(price),
        prod_category: category,
        prod_image: image,
        prod_sale: sale
      })
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      showAdminAddMessage(result.error || 'A termék mentése nem sikerült.', true);
      return;
    }

    showAdminAddMessage('A termék sikeresen mentve.', false);
    event.target.reset();
    await loadAdminProducts();
    renderProducts(selectedCategory);
  } catch (error) {
    showAdminAddMessage(`Hiba: ${error.message}`, true);
  }
}

async function updateAdminProduct(prodId) {
  if (!prodId) return;

  const nameInput = document.getElementById(`admin-name-${prodId}`);
  const categoryInput = document.getElementById(`admin-category-${prodId}`);
  const imageInput = document.getElementById(`admin-image-${prodId}`);
  const priceInput = document.getElementById(`admin-price-${prodId}`);
  const saleInput = document.querySelector(`input[name="admin-sale-${prodId}"]:checked`);
  const requesterEmail = getRequesterEmailForAdmin();
  const newName = nameInput ? nameInput.value.trim() : '';
  const newCategory = categoryInput ? categoryInput.value.trim() : '';
  const newImage = imageInput ? imageInput.value.trim() : '';
  const newPrice = priceInput ? Number(priceInput.value) : NaN;
  const newSale = saleInput ? saleInput.value === '1' : false;

  if (!newName) {
    showAdminTableMessage('A név nem lehet üres.', true);
    return;
  }

  if (!Number.isFinite(newPrice) || newPrice < 0) {
    showAdminTableMessage('Érvénytelen ár.', true);
    return;
  }

  try {
    const res = await fetch(`http://localhost:5000/products/${prodId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requester_email: requesterEmail,
        prod_name: newName,
        prod_category: newCategory,
        prod_image: newImage,
        prod_price: newPrice,
        prod_sale: newSale
      })
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      showAdminTableMessage(result.error || 'A termék frissítése nem sikerült.', true);
      return;
    }

    showAdminTableMessage('A termék adatai frissítve.', false);
    await loadAdminProducts();
    renderProducts(selectedCategory);
  } catch (error) {
    showAdminTableMessage(`Hiba: ${error.message}`, true);
  }
}

async function deleteAdminProduct(prodId) {
  if (!prodId) return;

  const ok = confirm('Biztosan törlöd ezt a terméket?');
  if (!ok) return;

  const requesterEmail = getRequesterEmailForAdmin();

  try {
    const res = await fetch(`http://localhost:5000/products/${prodId}?requester_email=${encodeURIComponent(requesterEmail)}`, {
      method: 'DELETE'
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      showAdminTableMessage(result.error || 'A törlés nem sikerült.', true);
      return;
    }

    showAdminTableMessage('A termék törölve.', false);
    await loadAdminProducts();
    renderProducts(selectedCategory);
  } catch (error) {
    showAdminTableMessage(`Hiba: ${error.message}`, true);
  }
}

function initAdminPage() {
  const user = getCurrentUser();
  if (!user || !user.isAdmin) return;

  const addForm = document.getElementById('admin-add-product-form');
  const refreshBtn = document.getElementById('admin-refresh-products');
  const searchInput = document.getElementById('admin-product-search');

  if (addForm) {
    addForm.removeEventListener('submit', handleAdminAddProduct);
    addForm.addEventListener('submit', handleAdminAddProduct);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadAdminProducts);
  }

  if (searchInput) {
    searchInput.removeEventListener('input', filterAdminProductsList);
    searchInput.addEventListener('input', filterAdminProductsList);
  }

  loadAdminProducts();
}

document.addEventListener("DOMContentLoaded", () => {
  initCartEvents();
  updateCartBadge();
  renderCartItems();
  updateAuthNav();
  renderProducts(selectedCategory);
  updateProductCartUI();
  initMainSearchEvents();
  initSidebarPriceFilter();
  initPaymentPage();
});

async function handleRegister(event) {
  event.preventDefault();
  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const lastName = document.getElementById("register-last-name").value;
  const firstName = document.getElementById("register-first-name").value;
  const messageElement = document.getElementById("register-message");

  if (password !== confirmPassword) {
    messageElement.textContent = 'A jelszó és a megerősítés nem egyezik.';
    messageElement.style.color = 'red';
    return;
  }

  const apiUrl = 'http://localhost:5000/register';

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({email, password, confirmPassword, firstName, lastName})
    });
    const result = await res.json();

    if (res.ok && result.success) {
      sessionStorage.setItem('pendingVerificationEmail', email);
      const formSection = document.getElementById('register-form-section');
      const verifySection = document.getElementById('verify-section');
      if (formSection) formSection.style.display = 'none';
      if (verifySection) verifySection.style.display = 'block';
      messageElement.textContent = '';
      return;
    }

    messageElement.textContent = result.error || 'Hiba történt a regisztrációnál.';
    messageElement.style.color = 'red';
  } catch (error) {
    messageElement.textContent = 'Kapcsolati hiba: ' + error.message;
    messageElement.style.color = 'red';
  }
}


async function handleVerifyEmail(event) {
  event.preventDefault();
  const code = document.getElementById("verify-code").value.trim();
  const messageElement = document.getElementById("verify-message");
  const email = sessionStorage.getItem('pendingVerificationEmail') || '';

  if (!email) {
    messageElement.textContent = 'Nincs regisztrációs session. Próbáld újra.';
    messageElement.style.color = 'red';
    return;
  }

  const apiUrl = 'http://localhost:5000/verify-email';

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({email, code})
    });
    const result = await res.json();

    if (res.ok && result.success) {
      sessionStorage.removeItem('pendingVerificationEmail');
      messageElement.textContent = 'Email sikeresen megerősítve! Átirányítunk...';
      messageElement.style.color = 'green';
      setTimeout(() => {
        loadPage('register_done');
      }, 2000);
      return;
    }

    messageElement.textContent = result.error || 'Nem sikerült az email megerősítése.';
    messageElement.style.color = 'red';
  } catch (error) {
    messageElement.textContent = 'Kapcsolati hiba: ' + error.message;
    messageElement.style.color = 'red';
  }
}


async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const messageElement = document.getElementById("login-message");

  const apiUrl = 'http://localhost:5000/login';

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({email, password})
    });
    const result = await res.json();

    if (res.ok && result.success) {
      setCurrentUser(result.user || { firstName: '', lastName: '' });
      messageElement.textContent = 'Sikeres bejelentkezés.';
      messageElement.style.color = 'green';
      loadPage('index');
      return;
    }

    messageElement.textContent = result.error || 'Hiba történt a belépésnél.';
    messageElement.style.color = 'red';
  } catch (error) {
    messageElement.textContent = 'Kapcsolati hiba: ' + error.message;
    messageElement.style.color = 'red';
  }
}
