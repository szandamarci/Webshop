async function loadPage(page) {

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
}

let selectedCategory = null;
const SIDEBAR_PRICE_MAX = 10000000;
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
    const matchesPrice = productPrice <= selectedPriceMax;

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
  label.textContent = `0 - ${selectedPriceMax.toLocaleString('hu-HU')} Ft`;
}

function initSidebarPriceFilter() {
  const range = document.getElementById('sidebar-price-range');
  if (!range) return;

  range.min = '0';
  range.max = String(SIDEBAR_PRICE_MAX);
  range.step = '1000';
  range.value = String(selectedPriceMax);

  range.oninput = (event) => {
    const value = Number(event.target.value);
    selectedPriceMax = Number.isFinite(value) ? value : SIDEBAR_PRICE_MAX;
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
