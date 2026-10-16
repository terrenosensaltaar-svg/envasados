/**
 * App para Envasados al Vacío Gourmet & Caseros - Sé tu propio Chef
 */

// Teléfono fijo inmutable (Salta, Argentina: +54 387 228 3546)
const STORE_CONFIG = Object.freeze({
    storeName: "Envasados al Vacío Gourmet",
    whatsappPhone: "543872283546",
    deliveryFee: 2500,
    freeDeliveryThreshold: 25000
});

// Limpiar configuraciones previas de localStorage para garantizar el número fijo
localStorage.removeItem("env_config");

const CART_STORAGE_KEY = "env_cart";
const CART_SESSION_KEY = "env_cart_backup";

function readCartFromStorage(storage, key) {
    try {
        const raw = storage.getItem(key);
        if (raw === null) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed.filter(item => item && typeof item.id === "string" && Number.isInteger(item.qty) && item.qty > 0);
    } catch (_) {
        return null;
    }
}

function loadCart() {
    let savedCart = readCartFromStorage(localStorage, CART_STORAGE_KEY);
    if (savedCart === null) {
        const sessionCart = readCartFromStorage(sessionStorage, CART_SESSION_KEY);
        if (sessionCart !== null) {
            try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(sessionCart)); } catch (_) {}
            savedCart = sessionCart;
        }
    }
    if (!savedCart) return [];

    if (typeof LEGACY_ID_MAP !== "undefined") {
        savedCart = savedCart.map(item => {
            if (item && LEGACY_ID_MAP[item.id]) {
                return Object.assign({}, item, { id: LEGACY_ID_MAP[item.id] });
            }
            return item;
        });
    }
    return savedCart;
}

let cart = loadCart();
let deliveryMethod = "delivery"; // "delivery" o "pickup"
let currentCategoryFilter = "all";

function filterCategory(cat, btn) {
    currentCategoryFilter = cat;
    document.querySelectorAll(".cat-tab").forEach(tab => {
        const isActive = tab === btn || tab.getAttribute("data-cat") === cat;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    renderProducts();
}

function formatPrice(val) {
    return `$${Number(val).toLocaleString('es-AR')}`;
}

// Orden aleatorio de productos por visita / carga de página
let displayProducts = [];

function shuffleProducts(array) {
    const list = [...array];
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = list[i];
        list[i] = list[j];
        list[j] = temp;
    }
    return list;
}

function initRandomProductOrder() {
    displayProducts = shuffleProducts(PRODUCTS);
}

document.addEventListener("DOMContentLoaded", () => {
    initRandomProductOrder();
    renderProducts();
    updateCartUI();
});

// Placeholder con ícono cuando el producto no tiene imagen disponible.
function productPlaceholder(product) {
    const el = document.createElement("div");
    el.className = "card-img-placeholder";
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", product.name || "Producto");
    const span = document.createElement("span");
    span.textContent = product.icon || "🍽️";
    el.appendChild(span);
    return el;
}

// Reemplaza una imagen rota por el placeholder del producto (mismo id).
function productPlaceholderById(id) {
    const product = PRODUCTS.find(p => p.id === id) || {};
    return productPlaceholder(product);
}

function productMediaMarkup(product) {
    if (!product.image && !product.packImage) {
        return `<div class="card-img-placeholder" role="img" aria-label="${product.name}"><span>${product.icon || "🍽️"}</span></div>`;
    }

    if (product.packImage) {
        return `
            <div class="card-media-wrapper" id="media-wrap-${product.id}">
                <img src="${product.image}" alt="${product.name} - Plato preparado" class="card-img is-dish" id="img-dish-${product.id}" width="800" height="490" loading="lazy" decoding="async">
                <img src="${product.packImage}" alt="${product.name} - Envasado al vacío" class="card-img is-pack" id="img-pack-${product.id}" width="800" height="490" loading="lazy" decoding="async" style="display: none;">
                <div class="view-switcher" onclick="event.stopPropagation()">
                    <button type="button" class="view-btn is-active" onclick="switchMediaView('${product.id}', 'dish', this)">🍽️ Servido</button>
                    <button type="button" class="view-btn" onclick="switchMediaView('${product.id}', 'pack', this)">📦 Envasado</button>
                </div>
            </div>
        `;
    }

    return `<img src="${product.image}" alt="${product.name}" class="card-img" width="800" height="490" loading="lazy" decoding="async" onerror="this.replaceWith(productPlaceholderById('${product.id}'))">`;
}

function switchMediaView(id, view, btn) {
    const packImg = document.getElementById(`img-pack-${id}`);
    const dishImg = document.getElementById(`img-dish-${id}`);
    const switcher = btn.closest(".view-switcher");
    if (switcher) {
        switcher.querySelectorAll(".view-btn").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
    }
    if (view === "pack") {
        if (packImg) packImg.style.display = "block";
        if (dishImg) dishImg.style.display = "none";
    } else {
        if (packImg) packImg.style.display = "none";
        if (dishImg) dishImg.style.display = "block";
    }
}

function renderProducts() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    if (!displayProducts || displayProducts.length === 0) {
        initRandomProductOrder();
    }

    const filtered = currentCategoryFilter === "all"
        ? displayProducts
        : displayProducts.filter(p => p.category === currentCategoryFilter);

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No hay productos disponibles en esta categoría.</div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const item = cart.find(c => c.id === p.id);
        const qty = item ? item.qty : 0;
        const isOutOfStock = p.outOfStock === true || p.available === false;
        const canOrder = !isOutOfStock && Number.isFinite(p.price) && p.price > 0;

        return `
            <article class="card ${isOutOfStock ? "is-out-of-stock" : ""}">
                <div class="card-img-wrap">
                    ${productMediaMarkup(p)}
                    <span class="card-badge ${isOutOfStock ? "badge-sin-stock" : ""}">${isOutOfStock ? "🚫 Sin Stock" : p.badge}</span>
                </div>
                <div class="card-body">
                    <span class="card-portion">${p.portion}</span>
                    <h3 class="card-title">${p.name}</h3>
                    <p class="card-desc">${p.desc}</p>
                    <div class="card-prep">
                        <span>👨‍🍳</span>
                        <span>${p.prep}</span>
                    </div>
                    <div class="card-footer">
                        <span class="card-price">${Number.isFinite(p.price) ? formatPrice(p.price) : "Precio a confirmar"}</span>
                        ${canOrder && qty > 0 ? `
                            <div class="qty-control">
                                <button class="qty-btn" onclick="updateQty('${p.id}', ${qty - 1})">−</button>
                                <span class="qty-val">${qty}</span>
                                <button class="qty-btn" onclick="updateQty('${p.id}', ${qty + 1})">+</button>
                            </div>
                        ` : canOrder ? `
                            <button class="btn-add" onclick="addToCart('${p.id}')">+ Agregar</button>
                        ` : isOutOfStock ? `
                            <button class="btn-add btn-sin-stock" type="button" disabled>🚫 Sin Stock</button>
                        ` : `<button class="btn-add" type="button" disabled>Próximamente</button>`}
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

function addToCart(id) {
    const product = PRODUCTS.find(p => p.id === id);
    if (!product || product.available === false || product.outOfStock === true || !Number.isFinite(product.price) || product.price <= 0) return;
    const item = cart.find(c => c.id === id);
    if (item) {
        item.qty += 1;
    } else {
        cart.push({ id, qty: 1 });
    }
    saveCart();
    renderProducts();
    updateCartUI();
    showToast("Agregado al pedido de Chef");
}

function updateQty(id, qty) {
    if (qty <= 0) {
        cart = cart.filter(c => c.id !== id);
    } else {
        const item = cart.find(c => c.id === id);
        if (item) item.qty = qty;
    }
    saveCart();
    renderProducts();
    updateCartUI();
}

function saveCart() {
    const snapshot = JSON.stringify(cart);
    try { localStorage.setItem(CART_STORAGE_KEY, snapshot); } catch (error) { console.warn("No se pudo guardar el carrito localmente:", error); }
    try { sessionStorage.setItem(CART_SESSION_KEY, snapshot); } catch (error) { console.warn("No se pudo guardar la copia de sesión del carrito:", error); }
}

function updateCartUI() {
    const totalCount = cart.reduce((sum, i) => sum + i.qty, 0);
    document.querySelectorAll(".cart-count").forEach(el => el.textContent = totalCount);

    let subtotal = 0;
    cart.forEach(item => {
        const p = PRODUCTS.find(prod => prod.id === item.id);
        if (p) subtotal += p.price * item.qty;
    });

    let shipping = 0;
    if (deliveryMethod === "delivery") {
        shipping = (subtotal >= STORE_CONFIG.freeDeliveryThreshold || subtotal === 0) ? 0 : STORE_CONFIG.deliveryFee;
    }
    const total = subtotal + shipping;

    // Actualizar Drawer
    const list = document.getElementById("cart-items");
    const emptyMsg = document.getElementById("cart-empty");
    const checkoutBox = document.getElementById("checkout-box");
    const drawerFooter = document.getElementById("drawer-footer");

    if (cart.length === 0) {
        if (list) list.innerHTML = "";
        if (emptyMsg) emptyMsg.style.display = "block";
        if (checkoutBox) checkoutBox.style.display = "none";
        if (drawerFooter) drawerFooter.style.display = "none";
    } else {
        if (emptyMsg) emptyMsg.style.display = "none";
        if (checkoutBox) checkoutBox.style.display = "block";
        if (drawerFooter) drawerFooter.style.display = "block";

        if (list) {
            list.innerHTML = cart.map(item => {
                const p = PRODUCTS.find(prod => prod.id === item.id);
                if (!p) return "";
                return `
                    <div class="cart-item">
                        <img src="${p.image}" class="cart-item-img" alt="${p.name}">
                        <div class="cart-item-info">
                            <div class="cart-item-title">${p.name}</div>
                            <div class="cart-item-price">${formatPrice(p.price)} c/u</div>
                        </div>
                        <div class="qty-control">
                            <button class="qty-btn" onclick="updateQty('${p.id}', ${item.qty - 1})">−</button>
                            <span class="qty-val">${item.qty}</span>
                            <button class="qty-btn" onclick="updateQty('${p.id}', ${item.qty + 1})">+</button>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }

    const subtotalEl = document.getElementById("subtotal-val");
    const shippingEl = document.getElementById("shipping-val");
    const totalEl = document.getElementById("total-val");
    const floatTotal = document.getElementById("float-total");

    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (shippingEl) shippingEl.textContent = shipping === 0 ? "Gratis" : formatPrice(shipping);
    if (totalEl) totalEl.textContent = formatPrice(total);
    if (floatTotal) floatTotal.textContent = formatPrice(total);

    const floatBtn = document.getElementById("cart-float");
    if (floatBtn) {
        if (totalCount > 0) floatBtn.classList.add("show");
        else floatBtn.classList.remove("show");
    }
}

function setDeliveryMethod(method) {
    deliveryMethod = method;
    const addrGroup = document.getElementById("address-group");
    if (addrGroup) {
        addrGroup.style.display = method === "pickup" ? "none" : "block";
    }
    updateCartUI();
}

function toggleCart(open) {
    const drawer = document.getElementById("drawer");
    const overlay = document.getElementById("drawer-overlay");
    if (!drawer || !overlay) return;

    if (open) {
        drawer.classList.add("active");
        overlay.classList.add("active");
    } else {
        drawer.classList.remove("active");
        overlay.classList.remove("active");
    }
}

async function sendWhatsApp() {
    if (cart.length === 0) return;

    const name = (document.getElementById("cust-name")?.value || "").trim();
    const address = (document.getElementById("cust-address")?.value || "").trim();
    const payment = document.getElementById("cust-payment")?.value || "Transferencia";
    const notes = (document.getElementById("cust-notes")?.value || "").trim();

    if (!name) {
        alert("Por favor indica tu nombre");
        document.getElementById("cust-name")?.focus();
        return;
    }

    if (deliveryMethod === "delivery" && !address) {
        alert("Por favor indica tu dirección de entrega");
        document.getElementById("cust-address")?.focus();
        return;
    }

    let subtotal = 0;
    const itemsText = cart.map(item => {
        const p = PRODUCTS.find(prod => prod.id === item.id);
        if (!p) return "";
        const line = p.price * item.qty;
        subtotal += line;
        return `• *${item.qty}x* ${p.name} (${formatPrice(line)})`;
    }).filter(Boolean).join("\n");

    let shipping = 0;
    if (deliveryMethod === "delivery") {
        shipping = (subtotal >= STORE_CONFIG.freeDeliveryThreshold) ? 0 : STORE_CONFIG.deliveryFee;
    }
    const total = subtotal + shipping;

    const msg = [
        `👨‍🍳 *NUEVO PEDIDO - EXPERIENCIA EN TU CASA*`,
        `*Comida Casera & Gourmet al Vacío*`,
        `─────────────────────`,
        `👤 *Cliente:* ${name}`,
        `📍 *Modalidad:* ${deliveryMethod === "delivery" ? `Envío a domicilio (${address})` : "Retiro en local"}`,
        `💳 *Medio de Pago:* ${payment}`,
        `─────────────────────`,
        `🛒 *DETALLE DEL PEDIDO:*`,
        itemsText,
        `─────────────────────`,
        `📦 Subtotal: ${formatPrice(subtotal)}`,
        `🛵 Despacho: ${shipping === 0 ? "Gratis" : formatPrice(shipping)}`,
        `💰 *TOTAL A PAGAR: ${formatPrice(total)}*`,
        notes ? `📝 *Nota especial:* ${notes}` : null,
        `─────────────────────`,
        `_Listo para regenerar y servir con calidad de restaurante en mi mesa._`
    ].filter(Boolean).join("\n");

    const cleanPhone = STORE_CONFIG.whatsappPhone;
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
    const submitButton = document.querySelector(".btn-whatsapp-send");

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
    }

    // Registrar el pedido antes de abrir WhatsApp y comprobar también los errores
    // devueltos por PostgREST (no siempre se rechaza la promesa).
    if (window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient.from("store_orders").insert({
                customer_name: name,
                delivery_method: deliveryMethod,
                delivery_address: deliveryMethod === "delivery" ? address : "",
                payment_method: payment,
                notes,
                items: cart.map(item => {
                    const product = PRODUCTS.find(prod => prod.id === item.id);
                    return {
                        product_id: item.id,
                        name: product ? product.name : "Producto",
                        quantity: item.qty,
                        unit_price: product ? product.price : 0
                    };
                }),
                subtotal,
                shipping,
                total
            });
            if (error) throw error;
        } catch (error) {
            console.warn("Aviso: no se pudo sincronizar con la base de datos de respaldo:", error);
            alert("No pudimos guardar el pedido en el sistema. Podés continuar por WhatsApp, pero avisá que el pedido no quedó registrado en el panel.");
        }
    } else {
        console.warn("No se pudo sincronizar: el cliente de Supabase no está inicializado.");
        alert("No pudimos conectar con el sistema de pedidos. Podés continuar por WhatsApp, pero avisá que el pedido no quedó registrado en el panel.");
    }

    // Conservamos el carrito al salir a WhatsApp para que siga disponible al regresar.
    saveCart();
    // Abrir WhatsApp con el pedido generado
    window.open(url, "_blank");

    if (submitButton) {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
    }
}

function consultPollitaLu(flavorName = "") {
    const cleanPhone = STORE_CONFIG.whatsappPhone;
    const topic = flavorName ? ` por el sabor *${flavorName}*` : "";
    const msg = `Hola! Me gustaría consultar disponibilidad y hacer un pedido${topic} de la línea *Pollita Lu (Congelados al Vacío)* para cocinar en casa.`;
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
}

function showToast(text) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}
