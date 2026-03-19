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
    renderProducts();
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
  // Rediscover buttons if we dynamically replaced content.
  initCartEvents();
  updateCartBadge();  
  renderCartItems();
  updateAuthNav();
  updateProductCartUI();
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
  const userItem = document.getElementById('nav-user');
  const userLabel = document.getElementById('user-display');

  if (user) {
    if (loginItem) loginItem.style.display = 'none';
    if (registerItem) registerItem.style.display = 'none';
    if (userItem) userItem.style.display = 'flex';
    if (userLabel) userLabel.textContent = `${user.firstName} ${user.lastName}`.trim();
  } else {
    if (loginItem) loginItem.style.display = 'block';
    if (registerItem) registerItem.style.display = 'block';
    if (userItem) userItem.style.display = 'none';
    if (userLabel) userLabel.textContent = '';
  }
}

function logout() {
  clearCurrentUser();
  loadPage('index');
}

async function renderProducts() {
  const container = document.getElementById('dynamic-products-grid');
  const staticRow = document.getElementById('static-products-row');

  if (!container) return;
  if (staticRow) staticRow.style.display = 'none';

  container.innerHTML = '<div class="col-12 text-center py-5">Termékek betöltése...</div>';

  try {
    const res = await fetch('http://localhost:5000/products');
    if (!res.ok) {
      container.innerHTML = '<div class="col-12 text-center text-danger py-5">Nem sikerült betölteni a termékeket.</div>';
      return;
    }

    const result = await res.json();
    const products = (result && result.products) || [];

    if (!products.length) {
      container.innerHTML = '<div class="col-12 text-center py-5">Nincsenek elérhető termékek.</div>';
      return;
    }

    container.innerHTML = products.map(prod => {
      const imageUrl = prod.prod_image || 'https://dummyimage.com/450x300/dee2e6/6c757d.jpg';
      const price = prod.prod_price ? parseFloat(prod.prod_price) : 0;
      const priceDisplay = price ? price.toFixed(2) + ' Ft' : 'Nincs ár';
      return `
        <div class="col mb-5">
          <div class="card h-100">
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
}

function searchProducts() {
  const query = document.getElementById('search')?.value.trim().toLowerCase() || '';
  const productCols = document.querySelectorAll('#dynamic-products-grid .col, #static-products-row .col, #content .col');
  if (!productCols.length) return;

  productCols.forEach(col => {
    const title = col.querySelector('.card-body h5')?.textContent?.toLowerCase() || '';
    const price = col.querySelector('.card-body p')?.textContent?.toLowerCase() || '';
    const alt = col.querySelector('.card-img-top')?.alt?.toLowerCase() || '';
    const content = `${title} ${price} ${alt}`;

    if (!query || content.includes(query)) {
      col.style.display = '';
    } else {
      col.style.display = 'none';
    }
  });
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

document.addEventListener("DOMContentLoaded", () => {
  initCartEvents();
  updateCartBadge();
  renderCartItems();
  updateAuthNav();
  renderProducts();
  updateProductCartUI();

  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.addEventListener('input', searchProducts);
  }
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
      loadPage('register_done');
      return;
    }

    messageElement.textContent = result.error || 'Hiba történt a regisztrációnál.';
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
