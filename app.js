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

// Ruta de la versión liviana generada por optimizar-imagenes.ps1 (img-opt/<nombre>-640.jpg o -160.jpg).
function optimizedImage(src, size) {
    if (!src || !/\.jpe?g$/i.test(src) || /^(https?:)?\/\//i.test(src)) return src;
    return "img-opt/" + src.replace(/\.jpe?g$/i, `-${size}.jpg`);
}

// El SDK de Supabase (~170 KB) solo se necesita al confirmar el pedido. Se descarga en segundo
// plano cuando el navegador está libre, así no retrasa la primera pantalla en conexiones lentas.
let supabaseLoading = null;

function loadScriptOnce(src) {
    return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
}

function loadSupabase() {
    if (window.supabaseClient) return Promise.resolve(window.supabaseClient);
    if (supabaseLoading) return supabaseLoading;
    supabaseLoading = (async () => {
        if (!window.supabase) {
            await loadScriptOnce("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
        }
        if (!window.supabaseClient) {
            if (typeof SUPABASE_URL === "undefined") {
                await loadScriptOnce("supabase-config.js");
            } else if (window.supabase && typeof window.supabase.createClient === "function") {
                // La configuración ya se había cargado (reintento tras un fallo del CDN).
                window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            }
        }
        return window.supabaseClient || null;
    })();
    // Si falló, permitimos reintentar en el próximo pedido.
    supabaseLoading.then((client) => { if (!client) supabaseLoading = null; });
    return supabaseLoading;
}

window.addEventListener("load", () => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    idle(() => { loadSupabase(); });
});

// Orden aleatorio de productos por visita / carga de página:
// 1º Empanadas con stock (aleatorio)
// 2º Pollita Lu con stock (aleatorio)
// 3º Otros productos con stock (aleatorio)
// 4º Productos sin stock al final
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
    const isOutOfStock = (p) => p.outOfStock === true || p.available === false;
    const isEmpanada = (p) => (p.name && p.name.toLowerCase().includes("empanada")) || p.id === "gm-01" || p.id === "gm-02";
    const isPollita = (p) => p.category === "pollita" || p.id.startsWith("pl-");

    const inStockEmpanadas = [];
    const inStockPollita = [];
    const inStockOther = [];
    const outOfStock = [];

    PRODUCTS.forEach((p) => {
        if (isOutOfStock(p)) {
            outOfStock.push(p);
        } else if (isEmpanada(p)) {
            inStockEmpanadas.push(p);
        } else if (isPollita(p)) {
            inStockPollita.push(p);
        } else {
            inStockOther.push(p);
        }
    });

    displayProducts = [
        ...shuffleProducts(inStockEmpanadas),
        ...shuffleProducts(inStockPollita),
        ...shuffleProducts(inStockOther),
        ...outOfStock
    ];
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

// Si falta la versión liviana (img-opt/), reintenta con la foto original; si tampoco existe, muestra el ícono.
function productImgError(img, id) {
    const orig = img.getAttribute("data-orig");
    if (orig && img.getAttribute("src") !== orig) {
        img.src = orig;
        return;
    }
    img.replaceWith(productPlaceholderById(id));
}

// Estado del carrusel por producto (0 = primera vista, 1 = segunda vista)
const productSlideState = {};
const productSlidePausedUntil = {};
let productCarouselTimer = null;

function getProductSlides(product) {
    if (!product.image && !product.packImage) return [];
    if (product.packImage) {
        return [
            { src: product.image, alt: `${product.name} - Plato servido`, label: "🍽️ Servido", mode: "dish" },
            { src: product.packImage, alt: `${product.name} - Envasado al vacío`, label: "📦 Envasado", mode: "pack" }
        ];
    }
    return [
        { src: product.image, alt: `${product.name} - Presentación`, label: "🍽️ Plato", mode: "dish" },
        { src: product.image, alt: `${product.name} - Detalle gourmet`, label: "🔎 Detalle", mode: "detail" }
    ];
}

function productMediaMarkup(product, cardIndex = 99) {
    const slides = getProductSlides(product);
    if (slides.length === 0) {
        return `<div class="card-img-placeholder" role="img" aria-label="${product.name}"><span>${product.icon || "🍽️"}</span></div>`;
    }

    const activeIdx = productSlideState[product.id] ? 1 : 0;

    return `
        <div class="card-media-wrapper card-carousel" id="media-wrap-${product.id}" data-product-id="${product.id}" data-slide="${activeIdx}"
             onmouseenter="pauseProductCarousel('${product.id}', true)"
             onmouseleave="pauseProductCarousel('${product.id}', false)">
            <div class="card-carousel-track" id="carousel-track-${product.id}" style="transform: translateX(-${activeIdx * 50}%);">
                ${slides.map((s, idx) => {
                    // Las dos primeras tarjetas (lo que se ve al abrir la página) cargan de inmediato; el resto, bajo demanda.
                    const eager = cardIndex < 2 && idx === 0;
                    return `
                    <div class="card-carousel-slide ${idx === activeIdx ? "is-current" : ""}" data-slide-idx="${idx}">
                        <img src="${optimizedImage(s.src, 640)}" data-orig="${s.src}" alt="${s.alt}" class="card-img is-${s.mode}" width="640" height="480"
                             ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"
                             onerror="productImgError(this, '${product.id}')">
                    </div>`;
                }).join("")}
            </div>
            <div class="carousel-dots" aria-hidden="true">
                ${slides.map((_, idx) => `<span class="carousel-dot ${idx === activeIdx ? "is-active" : ""}" onclick="event.stopPropagation(); setProductSlide('${product.id}', ${idx}, true)"></span>`).join("")}
            </div>
            <div class="view-switcher" onclick="event.stopPropagation()">
                ${slides.map((s, idx) => `
                    <button type="button" class="view-btn ${idx === activeIdx ? "is-active" : ""}" data-slide-btn="${idx}"
                            onclick="setProductSlide('${product.id}', ${idx}, true)">${s.label}</button>
                `).join("")}
            </div>
        </div>
    `;
}

function setProductSlide(id, slideIndex, manual = false) {
    const idx = slideIndex ? 1 : 0;
    productSlideState[id] = idx;

    if (manual) {
        productSlidePausedUntil[id] = Date.now() + 6000;
    }

    const wrap = document.getElementById(`media-wrap-${id}`);
    if (!wrap) return;
    wrap.setAttribute("data-slide", String(idx));

    const track = document.getElementById(`carousel-track-${id}`);
    if (track) {
        track.style.transform = `translateX(-${idx * 50}%)`;
        track.querySelectorAll(".card-carousel-slide").forEach((slide, i) => {
            slide.classList.toggle("is-current", i === idx);
        });
    }

    wrap.querySelectorAll(".view-btn").forEach((btn, i) => {
        btn.classList.toggle("is-active", i === idx);
    });

    wrap.querySelectorAll(".carousel-dot").forEach((dot, i) => {
        dot.classList.toggle("is-active", i === idx);
    });
}

function switchMediaView(id, view) {
    setProductSlide(id, view === "pack" || view === "detail" ? 1 : 0, true);
}

function pauseProductCarousel(id, paused) {
    if (paused) {
        productSlidePausedUntil[id] = Infinity;
    } else {
        productSlidePausedUntil[id] = Date.now() + 1200;
    }
}

// Solo animamos las tarjetas que están realmente en pantalla: mover 12 carruseles a la vez
// cada pocos segundos castiga la batería y la fluidez en celulares de gama baja.
const visibleCarousels = new Set();
let carouselObserver = null;
const prefersReducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

function observeCarousels() {
    if (!("IntersectionObserver" in window)) return;
    if (!carouselObserver) {
        carouselObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const id = entry.target.getAttribute("data-product-id");
                if (!id) return;
                if (entry.isIntersecting) visibleCarousels.add(id);
                else visibleCarousels.delete(id);
            });
        }, { threshold: 0.35 });
    }
    carouselObserver.disconnect();
    visibleCarousels.clear();
    document.querySelectorAll(".card-carousel[data-product-id]").forEach((el) => carouselObserver.observe(el));
}

function startProductCarousels() {
    if (productCarouselTimer) clearInterval(productCarouselTimer);
    if (prefersReducedMotion) return;
    productCarouselTimer = setInterval(() => {
        if (document.hidden) return;
        const now = Date.now();
        const wraps = document.querySelectorAll(".card-carousel[data-product-id]");
        wraps.forEach((wrap) => {
            const id = wrap.getAttribute("data-product-id");
            if (!id) return;
            if (carouselObserver && !visibleCarousels.has(id)) return;
            if ((productSlidePausedUntil[id] || 0) > now) return;
            const current = productSlideState[id] ? 1 : 0;
            setProductSlide(id, current === 0 ? 1 : 0, false);
        });
    }, 3200);
}


// Pie de la tarjeta (precio + botón agregar / selector de cantidad).
// Se genera aparte para poder refrescarlo solo, sin reconstruir la grilla completa.
function cardFooterMarkup(p) {
    const item = cart.find(c => c.id === p.id);
    const qty = item ? item.qty : 0;
    const isOutOfStock = p.outOfStock === true || p.available === false;
    const canOrder = !isOutOfStock && Number.isFinite(p.price) && p.price > 0;

    return `
        <span class="card-price">${Number.isFinite(p.price) ? formatPrice(p.price) : "Precio a confirmar"}</span>
        ${canOrder && qty > 0 ? `
            <div class="qty-control">
                <button class="qty-btn" type="button" data-act="dec" aria-label="Quitar una unidad de ${p.name}" onclick="updateQty('${p.id}', ${qty - 1})">−</button>
                <span class="qty-val" aria-live="polite">${qty}</span>
                <button class="qty-btn" type="button" data-act="inc" aria-label="Agregar una unidad de ${p.name}" onclick="updateQty('${p.id}', ${qty + 1})">+</button>
            </div>
        ` : canOrder ? `
            <button class="btn-add" type="button" data-act="add" aria-label="Agregar ${p.name} al pedido" onclick="addToCart('${p.id}')">+ Agregar</button>
        ` : isOutOfStock ? `
            <button class="btn-add btn-sin-stock" type="button" disabled>🚫 Sin Stock</button>
        ` : `<button class="btn-add" type="button" disabled>Próximamente</button>`}
    `;
}

// Actualiza solo el pie de una tarjeta y conserva el foco del teclado. Devuelve false si la tarjeta no está en pantalla.
function refreshCardFooter(id) {
    const product = PRODUCTS.find(p => p.id === id);
    const footer = document.getElementById(`card-footer-${id}`);
    if (!product || !footer) return false;

    const active = document.activeElement;
    const focusAct = active && footer.contains(active) ? active.getAttribute("data-act") : null;
    footer.innerHTML = cardFooterMarkup(product);

    if (focusAct) {
        const target = footer.querySelector(`[data-act="${focusAct === "add" ? "inc" : focusAct}"]`)
            || footer.querySelector("button:not([disabled])");
        if (target) target.focus({ preventScroll: true });
    }
    return true;
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

    grid.innerHTML = filtered.map((p, cardIndex) => {
        const isOutOfStock = p.outOfStock === true || p.available === false;

        return `
            <article class="card ${isOutOfStock ? "is-out-of-stock" : ""}">
                <div class="card-img-wrap">
                    ${productMediaMarkup(p, cardIndex)}
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
                    <div class="card-footer" id="card-footer-${p.id}">
                        ${cardFooterMarkup(p)}
                    </div>
                </div>
            </article>
        `;
    }).join("");

    observeCarousels();

    if (!productCarouselTimer) {
        startProductCarousels();
    }

    if (typeof window.updateCarouselStatus === "function") {
        window.updateCarouselStatus();
    }
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
    if (!refreshCardFooter(id)) renderProducts();
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
    if (!refreshCardFooter(id)) renderProducts();
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

    if (drawerFooter) {
        drawerFooter.style.display = "block";
    }

    if (cart.length === 0) {
        if (list) list.innerHTML = "";
        if (emptyMsg) emptyMsg.style.display = "block";
        if (checkoutBox) checkoutBox.style.display = "none";
    } else {
        if (emptyMsg) emptyMsg.style.display = "none";
        if (checkoutBox) checkoutBox.style.display = "block";

        if (list) {
            list.innerHTML = cart.map(item => {
                const p = PRODUCTS.find(prod => prod.id === item.id);
                if (!p) return "";
                return `
                    <div class="cart-item">
                        <img src="${optimizedImage(p.image, 160)}" class="cart-item-img" alt="${p.name}" width="46" height="46" loading="lazy" decoding="async"
                             onerror="if(this.dataset.fb!=='1'){this.dataset.fb='1';this.src='${p.image}'}">
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

    syncDrawerViewport();
}

function setDeliveryMethod(method) {
    deliveryMethod = method;
    const addrGroup = document.getElementById("address-group");
    if (addrGroup) {
        addrGroup.style.display = method === "pickup" ? "none" : "block";
    }
    updateCartUI();
}

let drawerSyncFrame = 0;

function applyDrawerViewport() {
    drawerSyncFrame = 0;
    const drawer = document.getElementById("drawer");
    if (!drawer) return;
    const vv = window.visualViewport;
    const height = vv ? Math.round(vv.height) : window.innerHeight;
    const offsetTop = vv ? Math.round(vv.offsetTop) : 0;
    if (height > 0) {
        drawer.style.height = `${height}px`;
        drawer.style.maxHeight = `${height}px`;
        drawer.style.top = `${offsetTop}px`;
        drawer.style.bottom = "auto";
    }
}

// Con el drawer cerrado no hay nada que ajustar: evitamos recalcular estilos en cada
// resize/scroll del visualViewport (la barra de direcciones del celular los dispara todo el tiempo).
function syncDrawerViewport(force = false) {
    const drawer = document.getElementById("drawer");
    if (!drawer) return;
    if (force !== true && !drawer.classList.contains("active")) return;
    if (force === true) {
        applyDrawerViewport();
        return;
    }
    if (!drawerSyncFrame) drawerSyncFrame = requestAnimationFrame(applyDrawerViewport);
}

function initDrawerViewportSync() {
    syncDrawerViewport();
    window.addEventListener("resize", syncDrawerViewport, { passive: true });
    window.addEventListener("orientationchange", () => {
        setTimeout(syncDrawerViewport, 100);
        setTimeout(syncDrawerViewport, 350);
    }, { passive: true });

    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", syncDrawerViewport, { passive: true });
        window.visualViewport.addEventListener("scroll", syncDrawerViewport, { passive: true });
    }

    const drawer = document.getElementById("drawer");
    if (!drawer) return;

    drawer.addEventListener("focusin", (e) => {
        setTimeout(syncDrawerViewport, 60);
        setTimeout(() => {
            syncDrawerViewport();
            if (e.target && typeof e.target.scrollIntoView === "function") {
                e.target.scrollIntoView({ block: "nearest", behavior: "smooth" });
            }
        }, 260);
    });

    drawer.addEventListener("focusout", () => {
        setTimeout(syncDrawerViewport, 80);
        setTimeout(syncDrawerViewport, 300);
    });
}

document.addEventListener("DOMContentLoaded", initDrawerViewportSync);

function toggleCart(open) {
    const drawer = document.getElementById("drawer");
    const overlay = document.getElementById("drawer-overlay");
    if (!drawer || !overlay) return;

    if (open) {
        drawer.classList.add("active");
        overlay.classList.add("active");
        syncDrawerViewport(true);
        setTimeout(() => syncDrawerViewport(true), 50);
    } else {
        drawer.classList.remove("active");
        overlay.classList.remove("active");
    }
}

async function sendWhatsApp() {
    if (cart.length === 0) {
        showToast("Agregá al menos un plato de la carta para enviar tu pedido");
        toggleCart(false);
        document.getElementById("carta")?.scrollIntoView({ behavior: "smooth" });
        return;
    }

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
    const submitButtons = document.querySelectorAll(".btn-whatsapp-send");

    submitButtons.forEach(btn => {
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
    });

    // Registrar el pedido antes de abrir WhatsApp y comprobar también los errores
    // devueltos por PostgREST (no siempre se rechaza la promesa).
    // Supabase se descarga en segundo plano (ver loadSupabase); aquí nos aseguramos de tenerlo listo.
    await loadSupabase();
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

    submitButtons.forEach(btn => {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
    });
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
