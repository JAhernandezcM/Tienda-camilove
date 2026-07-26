// Carrito de compras Camilove - basado en localStorage, sin backend.
(function () {
  var STORAGE_KEY = "camilove_cart";
  var MIN_PURCHASE = 50000;

  function formatPrice(n) {
    return "$" + Number(n).toLocaleString("es-CO");
  }

  function getProductById(id) {
    id = Number(id);
    return (window.CAMILOVE_PRODUCTS || []).find(function (p) { return p.id === id; });
  }

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    renderCartBadge();
    renderCartSidebar();
  }

  function addToCart(id, qty) {
    id = Number(id);
    qty = qty || 1;
    var cart = getCart();
    var item = cart.find(function (i) { return i.id === id; });
    if (item) {
      item.qty += qty;
    } else {
      cart.push({ id: id, qty: qty });
    }
    saveCart(cart);
  }

  function setQty(id, qty) {
    id = Number(id);
    var cart = getCart();
    var item = cart.find(function (i) { return i.id === id; });
    if (!item) return;
    item.qty = Math.max(1, qty);
    saveCart(cart);
    renderCartSidebar();
  }

  function removeFromCart(id) {
    id = Number(id);
    var cart = getCart().filter(function (i) { return i.id !== id; });
    saveCart(cart);
    renderCartSidebar();
  }

  function clearCart() {
    saveCart([]);
  }

  function getCartDetails() {
    return getCart().map(function (i) {
      var product = getProductById(i.id);
      if (!product) return null;
      return { product: product, qty: i.qty, subtotal: product.price * i.qty };
    }).filter(Boolean);
  }

  function getCartCount() {
    return getCart().reduce(function (sum, i) { return sum + i.qty; }, 0);
  }

  function getCartTotal() {
    return getCartDetails().reduce(function (sum, d) { return sum + d.subtotal; }, 0);
  }

  function renderCartBadge() {
    var count = getCartCount();
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = count;
      el.style.display = count > 0 ? "flex" : "none";
    });
  }

  function renderCartSidebar() {
    var list = document.querySelector("[data-cart-items]");
    var subtotalEl = document.querySelector("[data-cart-subtotal]");
    var emptyEl = document.querySelector("[data-cart-empty]");
    if (!list) return;

    var details = getCartDetails();
    list.innerHTML = "";

    if (details.length === 0) {
      if (emptyEl) emptyEl.style.display = "block";
    } else {
      if (emptyEl) emptyEl.style.display = "none";
      details.forEach(function (d) {
        var row = document.createElement("div");
        row.className = "flex gap-4 p-2 hover:bg-surface-container-high rounded-lg transition-all";
        row.innerHTML =
          '<div class="w-16 h-16 bg-surface-variant rounded-lg overflow-hidden shrink-0">' +
          '<img class="w-full h-full object-cover object-top" src="' + d.product.image + '" alt="' + d.product.name + '">' +
          "</div>" +
          '<div class="flex-grow min-w-0">' +
          '<h4 class="font-semibold text-primary text-sm truncate">' + d.product.name + "</h4>" +
          '<p class="text-sm text-on-surface-variant">' + d.qty + " x " + formatPrice(d.product.price) + "</p>" +
          '<div class="flex items-center gap-2 mt-1">' +
          '<button class="w-6 h-6 rounded border border-outline flex items-center justify-center" data-qty-btn="-1" data-id="' + d.product.id + '">-</button>' +
          '<span class="text-sm w-4 text-center">' + d.qty + "</span>" +
          '<button class="w-6 h-6 rounded border border-outline flex items-center justify-center" data-qty-btn="1" data-id="' + d.product.id + '">+</button>' +
          '<button class="ml-auto text-error text-xs underline" data-remove-btn data-id="' + d.product.id + '">Quitar</button>' +
          "</div></div>";
        list.appendChild(row);
      });
    }

    if (subtotalEl) subtotalEl.textContent = formatPrice(getCartTotal());

    var msgEl = document.querySelector("[data-min-purchase-msg]");
    var linkEl = document.querySelector("[data-checkout-link]");
    var ctaEl = document.querySelector("[data-min-purchase-cta]");
    if (msgEl && linkEl) {
      var total = getCartTotal();
      if (details.length > 0 && total < MIN_PURCHASE) {
        var missing = MIN_PURCHASE - total;
        msgEl.textContent = "Te faltan " + formatPrice(missing) + " para el mínimo de compra de " + formatPrice(MIN_PURCHASE) + ".";
        msgEl.classList.remove("hidden");
        if (ctaEl) ctaEl.classList.remove("hidden");
        linkEl.classList.add("opacity-50", "pointer-events-none");
        linkEl.setAttribute("aria-disabled", "true");
        linkEl.setAttribute("tabindex", "-1");
      } else {
        msgEl.classList.add("hidden");
        if (ctaEl) ctaEl.classList.add("hidden");
        linkEl.classList.remove("opacity-50", "pointer-events-none");
        linkEl.removeAttribute("aria-disabled");
        linkEl.removeAttribute("tabindex");
      }
    }

    list.querySelectorAll("[data-qty-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-id"));
        var delta = Number(btn.getAttribute("data-qty-btn"));
        var item = getCart().find(function (i) { return i.id === id; });
        if (!item) return;
        if (item.qty + delta <= 0) {
          removeFromCart(id);
        } else {
          setQty(id, item.qty + delta);
        }
      });
    });
    list.querySelectorAll("[data-remove-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        removeFromCart(Number(btn.getAttribute("data-id")));
      });
    });
  }

  window.Cart = {
    MIN_PURCHASE: MIN_PURCHASE,
    formatPrice: formatPrice,
    getProductById: getProductById,
    getCart: getCart,
    addToCart: addToCart,
    setQty: setQty,
    removeFromCart: removeFromCart,
    clearCart: clearCart,
    getCartDetails: getCartDetails,
    getCartCount: getCartCount,
    getCartTotal: getCartTotal,
    renderCartBadge: renderCartBadge,
    renderCartSidebar: renderCartSidebar
  };

  document.addEventListener("DOMContentLoaded", function () {
    renderCartBadge();
    renderCartSidebar();
  });
})();
