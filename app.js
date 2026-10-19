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

const selectedVariantByProduct = {};

function getActiveVariant(product) {
    if (!product || !Array.isArray(product.variants) || product.variants.length === 0) return null;
    const preferredKey = selectedVariantByProduct[product.id];
    let chosen = preferredKey ? product.variants.find(v => v.key === preferredKey || v.id === preferredKey) : null;
    if (!chosen) {
        chosen = product.variants.find(v => v.available !== false && !v.outOfStock) || product.variants[0];
        if (chosen) selectedVariantByProduct[product.id] = chosen.key;
    }
    return chosen;
}

function findCatalogEntry(id) {
    if (!id || typeof PRODUCTS === "undefined" || !Array.isArray(PRODUCTS)) return null;
    const mappedId = (typeof LEGACY_ID_MAP !== "undefined" && LEGACY_ID_MAP[id]) ? LEGACY_ID_MAP[id] : id;

    for (const p of PRODUCTS) {
        if (Array.isArray(p.variants) && p.variants.length > 0) {
            const matchedVariant = p.variants.find(v => v.id === mappedId || (p.id === id && v.key === (selectedVariantByProduct[p.id] || "cruda")));
            if (matchedVariant) {
                return {
                    ...p,
                    ...matchedVariant,
                    parentId: p.id,
                    id: matchedVariant.id,
                    name: matchedVariant.fullName || `${p.name} (${matchedVariant.shortLabel || matchedVariant.label})`,
                    price: Number.isFinite(matchedVariant.price) ? matchedVariant.price : p.price,
                    image: matchedVariant.image || p.image,
                    packImage: matchedVariant.packImage || p.packImage,
                    available: matchedVariant.available !== false,
                    outOfStock: matchedVariant.outOfStock === true
                };
            }
        }
        if (p.id === mappedId) {
            return p;
        }
    }
    return null;
}
window.findCatalogEntry = findCatalogEntry;

function sanitizeCartItems(items) {
    if (!Array.isArray(items)) return [];
    const merged = new Map();
    items.forEach(rawItem => {
        if (!rawItem || typeof rawItem.id !== "string" || !Number.isInteger(rawItem.qty) || rawItem.qty <= 0) return;
        const mappedId = (typeof LEGACY_ID_MAP !== "undefined" && LEGACY_ID_MAP[rawItem.id])
            ? LEGACY_ID_MAP[rawItem.id]
            : rawItem.id;
        if (typeof PRODUCTS !== "undefined" && Array.isArray(PRODUCTS)) {
            const prod = findCatalogEntry(mappedId);
            if (!prod || prod.outOfStock === true || prod.available === false) return;
        }
        merged.set(mappedId, (merged.get(mappedId) || 0) + rawItem.qty);
    });
    return Array.from(merged.entries()).map(([id, qty]) => ({ id, qty }));
}

function loadCart() {
    let savedCart = readCartFromStorage(localStorage, CART_STORAGE_KEY);
    if (savedCart === null) {
        const sessionCart = readCartFromStorage(sessionStorage, CART_SESSION_KEY);
        if (sessionCart !== null) {
            savedCart = sessionCart;
        }
    }
    if (!savedCart) return [];

    const cleanCart = sanitizeCartItems(savedCart);
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cleanCart));
        sessionStorage.setItem(CART_SESSION_KEY, JSON.stringify(cleanCart));
    } catch (_) {}
    return cleanCart;
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
    if (typeof window.initSupabaseClient === "function" && window.initSupabaseClient()) {
        return Promise.resolve(window.supabaseClient);
    }
    if (supabaseLoading) return supabaseLoading;
    supabaseLoading = (async () => {
        if (!window.supabase) {
            const loadedPrimary = await loadScriptOnce("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
            if (!loadedPrimary && !window.supabase) {
                await loadScriptOnce("https://unpkg.com/@supabase/supabase-js@2");
            }
        }
        if (typeof SUPABASE_URL === "undefined") {
            await loadScriptOnce("supabase-config.js");
        }
        if (!window.supabaseClient && typeof window.initSupabaseClient === "function") {
            window.initSupabaseClient();
        } else if (!window.supabaseClient && window.supabase && typeof window.supabase.createClient === "function" && typeof SUPABASE_URL !== "undefined") {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
        return window.supabaseClient || null;
    })();
    supabaseLoading.then((client) => { if (!client) supabaseLoading = null; });
    return supabaseLoading;
}

window.addEventListener("load", () => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
    idle(() => { loadSupabase(); });
});

const LOCAL_STOCK_STORAGE_KEY = "env_production_stock_local";
const STOCK_LEGACY_MAP = {
    "prod-01": "gm-01-cruda",
    "gm-01": "gm-01-cruda",
    "prod-19": "gm-02-cruda",
    "gm-02": "gm-02-cruda",
    "prod-14": "gm-03",
    "prod-18": "gm-04",
    "prod-04": "pl-01"
};

PRODUCTS.forEach((p) => {
    if (p._initialAvailable === undefined) p._initialAvailable = p.available !== false;
    if (p._initialOutOfStock === undefined) p._initialOutOfStock = p.outOfStock === true;
    if (p._activeBadge === undefined) {
        p._activeBadge = (!p.badge || p.badge === "Sin Stock")
            ? (p.category === "pollita" ? "Pollita Lu · Para cocinar" : "Línea Gourmet · 500g")
            : p.badge;
    }
    if (Array.isArray(p.variants)) {
        p.variants.forEach((v) => {
            if (v._initialOutOfStock === undefined) v._initialOutOfStock = v.outOfStock === true;
        });
    }
});

function applyStockRowsToCatalog(rows, isRemoteOnly = false) {
    if (!Array.isArray(rows) || rows.length === 0) return false;
    const byId = new Map();
    let anyPositive = false;

    rows.forEach((r) => {
        if (!r || !r.product_id || r.product_id === "__stock_trigger_v1__") return;
        const mappedId = STOCK_LEGACY_MAP[r.product_id] || r.product_id;
        const qty = Math.max(0, Number(r.quantity) || 0);
        if (qty > 0) anyPositive = true;
        const prev = byId.get(mappedId);
        if (!prev || qty > prev.quantity || r.configured_by_admin) {
            byId.set(mappedId, {
                quantity: qty,
                configured_by_admin: Boolean(r.configured_by_admin || qty > 0)
            });
        }
    });

    let changed = false;
    PRODUCTS.forEach((p) => {
        const wasOut = p.outOfStock === true || p.available === false;

        if (Array.isArray(p.variants) && p.variants.length > 0) {
            p.variants.forEach((v) => {
                const vWasOut = v.outOfStock === true || v.available === false;
                const entry = byId.get(v.id);
                if (entry) {
                    if (entry.quantity > 0) {
                        v.available = true;
                        v.outOfStock = false;
                    } else if (entry.configured_by_admin || v._initialOutOfStock || (isRemoteOnly && anyPositive)) {
                        v.available = false;
                        v.outOfStock = true;
                    }
                }
                const vNowOut = v.outOfStock === true || v.available === false;
                if (vWasOut !== vNowOut) changed = true;
            });

            const anyVariantAvailable = p.variants.some(v => v.available !== false && !v.outOfStock);
            p.available = anyVariantAvailable;
            p.outOfStock = !anyVariantAvailable;
            if (anyVariantAvailable) {
                p.badge = p._activeBadge;
                const currentSel = selectedVariantByProduct[p.id];
                const currentVar = p.variants.find(v => v.key === currentSel);
                if (!currentVar || currentVar.outOfStock || currentVar.available === false) {
                    const firstAvail = p.variants.find(v => v.available !== false && !v.outOfStock);
                    if (firstAvail) selectedVariantByProduct[p.id] = firstAvail.key;
                }
            }
        } else {
            const entry = byId.get(p.id);
            if (!entry) return;

            if (entry.quantity > 0) {
                p.available = true;
                p.outOfStock = false;
                p.badge = p._activeBadge;
            } else if (entry.configured_by_admin || p._initialOutOfStock || (isRemoteOnly && anyPositive)) {
                p.available = false;
                p.outOfStock = true;
            }
        }

        const isNowOut = p.outOfStock === true || p.available === false;
        if (wasOut !== isNowOut) changed = true;
    });

    return changed;
}

function syncLocalStockToCatalog() {
    try {
        const raw = localStorage.getItem(LOCAL_STOCK_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return applyStockRowsToCatalog(parsed, false);
    } catch (_) {
        return false;
    }
}

async function syncRemoteStockToCatalog() {
    try {
        const client = await loadSupabase();
        if (!client) return;
        const { data, error } = await client
            .from("production_stock")
            .select("product_id, quantity, updated_at");
        if (error || !Array.isArray(data) || data.length === 0) return;

        // Combinar con respaldo local si existe
        let localRows = [];
        try {
            localRows = JSON.parse(localStorage.getItem(LOCAL_STOCK_STORAGE_KEY) || "[]");
            if (!Array.isArray(localRows)) localRows = [];
        } catch (_) {
            localRows = [];
        }

        const combined = [...data];
        localRows.forEach((lr) => {
            if (lr && (lr.configured_by_admin || Number(lr.quantity) > 0)) {
                combined.push(lr);
            }
        });

        if (applyStockRowsToCatalog(combined, localRows.length === 0)) {
            initRandomProductOrder();
            renderProducts();
            updateCartUI();
        }
    } catch (_) {}
}

window.addEventListener("storage", (e) => {
    if (e.key === LOCAL_STOCK_STORAGE_KEY) {
        syncLocalStockToCatalog();
        initRandomProductOrder();
        renderProducts();
        updateCartUI();
    }
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
    syncLocalStockToCatalog();
    initRandomProductOrder();
    renderProducts();
    updateCartUI();
    syncRemoteStockToCatalog();
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


function cardVariantSelectorMarkup(p) {
    if (!Array.isArray(p.variants) || p.variants.length === 0) return "";
    const activeVariant = getActiveVariant(p);

    return `
        <div class="card-variant-box" id="card-variants-${p.id}" role="group" aria-label="Elegir presentación para ${p.name}">
            <span class="card-variant-title">Elegí presentación:</span>
            <div class="card-variant-options">
                ${p.variants.map((v) => {
                    const isSelected = activeVariant && activeVariant.id === v.id;
                    const isOut = v.outOfStock === true || v.available === false;
                    const inCart = cart.find(c => c.id === v.id);
                    const qty = inCart ? inCart.qty : 0;
                    return `
                        <button type="button"
                                class="card-variant-btn ${isSelected ? "is-selected" : ""} ${isOut ? "is-out" : ""}"
                                aria-pressed="${isSelected ? "true" : "false"}"
                                onclick="selectProductVariant('${p.id}', '${v.key}')">
                            <span class="card-variant-main">
                                <strong>${v.label}</strong>
                                ${qty > 0 ? `<span class="card-variant-qty">${qty} en pedido</span>` : ""}
                            </span>
                            <span class="card-variant-sub">${isOut ? "🚫 Sin stock" : (v.subLabel || "")}</span>
                        </button>
                    `;
                }).join("")}
            </div>
        </div>
    `;
}

function selectProductVariant(productId, variantKey) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product || !Array.isArray(product.variants)) return;
    selectedVariantByProduct[productId] = variantKey;
    refreshCardFooter(productId);
}
window.selectProductVariant = selectProductVariant;

// Pie de la tarjeta (precio + botón agregar / selector de cantidad).
// Se genera aparte para poder refrescarlo solo, sin reconstruir la grilla completa.
function cardFooterMarkup(p) {
    const activeVariant = getActiveVariant(p);
    const targetId = activeVariant ? activeVariant.id : p.id;
    const targetName = activeVariant ? (activeVariant.fullName || `${p.name} (${activeVariant.shortLabel})`) : p.name;
    const addLabel = activeVariant ? `+ Agregar ${activeVariant.shortLabel}` : "+ Agregar";

    const item = cart.find(c => c.id === targetId);
    const qty = item ? item.qty : 0;
    const isOutOfStock = activeVariant
        ? (activeVariant.outOfStock === true || activeVariant.available === false)
        : (p.outOfStock === true || p.available === false);
    const canOrder = !isOutOfStock && Number.isFinite(p.price) && p.price > 0;

    return `
        <span class="card-price">${Number.isFinite(p.price) ? formatPrice(p.price) : "Precio a confirmar"}</span>
        ${canOrder && qty > 0 ? `
            <div class="qty-control">
                <button class="qty-btn" type="button" data-act="dec" aria-label="Quitar una unidad de ${targetName}" onclick="updateQty('${targetId}', ${qty - 1})">−</button>
                <span class="qty-val" aria-live="polite">${qty}</span>
                <button class="qty-btn" type="button" data-act="inc" aria-label="Agregar una unidad de ${targetName}" onclick="updateQty('${targetId}', ${qty + 1})">+</button>
            </div>
        ` : canOrder ? `
            <button class="btn-add" type="button" data-act="add" aria-label="Agregar ${targetName} al pedido" onclick="addToCart('${targetId}')">${addLabel}</button>
        ` : isOutOfStock ? `
            <button class="btn-add btn-sin-stock" type="button" disabled>🚫 Sin Stock${activeVariant ? ` (${activeVariant.shortLabel})` : ""}</button>
        ` : `<button class="btn-add" type="button" disabled>Próximamente</button>`}
    `;
}

// Actualiza solo el pie de una tarjeta y conserva el foco del teclado. Devuelve false si la tarjeta no está en pantalla.
function refreshCardFooter(id) {
    const entry = findCatalogEntry(id);
    const cardId = entry?.parentId || id;
    const product = PRODUCTS.find(p => p.id === cardId);
    const footer = document.getElementById(`card-footer-${cardId}`);
    if (!product || !footer) return false;

    const activeVariant = getActiveVariant(product);
    const portionEl = document.getElementById(`card-portion-${cardId}`);
    const prepEl = document.getElementById(`card-prep-text-${cardId}`);
    const variantsWrap = document.getElementById(`card-variants-${cardId}`);

    if (activeVariant) {
        if (portionEl && activeVariant.portion) portionEl.textContent = activeVariant.portion;
        if (prepEl && activeVariant.prep) prepEl.textContent = activeVariant.prep;
    }
    if (variantsWrap) {
        variantsWrap.outerHTML = cardVariantSelectorMarkup(product);
    }

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
        const activeVariant = getActiveVariant(p);
        const portionText = (activeVariant && activeVariant.portion) ? activeVariant.portion : p.portion;
        const prepText = (activeVariant && activeVariant.prep) ? activeVariant.prep : p.prep;

        return `
            <article class="card ${isOutOfStock ? "is-out-of-stock" : ""}">
                <div class="card-img-wrap">
                    ${productMediaMarkup(p, cardIndex)}
                    <span class="card-badge ${isOutOfStock ? "badge-sin-stock" : ""}">${isOutOfStock ? "🚫 Sin Stock" : p.badge}</span>
                </div>
                <div class="card-body">
                    <span class="card-portion" id="card-portion-${p.id}">${portionText}</span>
                    <h3 class="card-title">${p.name}</h3>
                    <p class="card-desc">${p.desc}</p>
                    <div class="card-prep">
                        <span>👨‍🍳</span>
                        <span id="card-prep-text-${p.id}">${prepText}</span>
                    </div>
                    ${cardVariantSelectorMarkup(p)}
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
    const product = findCatalogEntry(id);
    if (!product || product.available === false || product.outOfStock === true || !Number.isFinite(product.price) || product.price <= 0) return;
    const targetId = product.id;
    const item = cart.find(c => c.id === targetId);
    if (item) {
        item.qty += 1;
    } else {
        cart.push({ id: targetId, qty: 1 });
    }
    saveCart();
    if (!refreshCardFooter(product.parentId || targetId)) renderProducts();
    updateCartUI();
    showToast(`Agregado: ${product.name}`);
}

function updateQty(id, qty) {
    const product = findCatalogEntry(id);
    const targetId = product ? product.id : id;
    if (qty <= 0) {
        cart = cart.filter(c => c.id !== targetId && c.id !== id);
    } else {
        const item = cart.find(c => c.id === targetId || c.id === id);
        if (item) item.qty = qty;
    }
    saveCart();
    if (!refreshCardFooter(product?.parentId || targetId)) renderProducts();
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
        const p = findCatalogEntry(item.id);
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
                const p = findCatalogEntry(item.id);
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

async function persistOrderInSupabase(orderPayload) {
    await loadSupabase();
    if (window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient.from("store_orders").insert(orderPayload);
            if (!error) return true;
            console.warn("Reintentando registro de pedido por API directa:", error);
        } catch (sdkErr) {
            console.warn("Error en SDK de Supabase, intentando API directa:", sdkErr);
        }
    }

    const urlBase = (typeof SUPABASE_URL !== "undefined" && SUPABASE_URL) || window.SUPABASE_URL || "https://fotttmvhpxtvzgykwvly.supabase.co";
    const anonKey = (typeof SUPABASE_ANON_KEY !== "undefined" && SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdHR0bXZocHh0dnpneWt3dmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NTY5NzYsImV4cCI6MjEwNzQzMjk3Nn0.Wb0FOIHMeVrDGACFdL8OkVNtgOu0Hr5WJrNlj_-GDyY";

    try {
        const res = await fetch(`${urlBase}/rest/v1/store_orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": anonKey,
                "Authorization": `Bearer ${anonKey}`,
                "Prefer": "return=minimal"
            },
            body: JSON.stringify(orderPayload),
            keepalive: true
        });
        if (res.ok) return true;
        console.warn("Respuesta no exitosa al registrar pedido:", res.status);
    } catch (fetchErr) {
        console.warn("No se pudo sincronizar el pedido con la base de datos:", fetchErr);
    }
    return false;
}

async function sendWhatsApp() {
    cart = sanitizeCartItems(cart);
    if (cart.length === 0) {
        updateCartUI();
        showToast("Agregá al menos un plato disponible de la carta para enviar tu pedido");
        toggleCart(false);
        document.getElementById("carta")?.scrollIntoView({ behavior: "smooth" });
        return;
    }

    const nameInput = document.getElementById("cust-name");
    const addressInput = document.getElementById("cust-address");
    const name = (nameInput?.value || "").trim();
    const address = (addressInput?.value || "").trim();
    const payment = document.getElementById("cust-payment")?.value || "Transferencia";
    const notes = (document.getElementById("cust-notes")?.value || "").trim();

    if (!name) {
        showToast("Por favor completá tu nombre para enviar el pedido");
        nameInput?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => nameInput?.focus(), 180);
        return;
    }

    if (deliveryMethod === "delivery" && !address) {
        showToast("Por favor indicá tu dirección de entrega");
        addressInput?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => addressInput?.focus(), 180);
        return;
    }

    const validItems = [];
    let subtotal = 0;
    const itemsText = cart.map(item => {
        const p = findCatalogEntry(item.id);
        if (!p) return "";
        const line = p.price * item.qty;
        subtotal += line;
        validItems.push({
            product_id: p.id,
            name: p.name,
            quantity: item.qty,
            unit_price: p.price
        });
        return `• *${item.qty}x* ${p.name} (${formatPrice(line)})`;
    }).filter(Boolean).join("\n");

    if (validItems.length === 0 || subtotal <= 0) {
        showToast("Agregá al menos un plato válido para continuar");
        return;
    }

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

    const savedOk = await persistOrderInSupabase({
        customer_name: name,
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === "delivery" ? address : "",
        payment_method: payment,
        notes,
        items: validItems,
        subtotal,
        shipping,
        total
    });

    if (!savedOk) {
        showToast("Abriendo WhatsApp para confirmar tu pedido…");
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
