/**
 * Catálogo interactivo de indexv2.html.
 * Se carga después de products.js, app.js e index-mejorado.js (defer conserva el orden)
 * y reemplaza solo cómo se dibuja la carta: carrito, stock y pedidos siguen en app.js.
 */
(function () {
    "use strict";

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

    const CARD_TINTS = ["#fbf1e7", "#f4f1e6", "#fcefe3", "#f2f4ea"];
    const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    const ICON_CART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L20 8H6"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>';

    let selectedId = null;
    let selectedView = "dish";
    let searchTerm = "";

    const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const isProductOut = (p) => p.outOfStock === true || p.available === false;
    const lineName = (p) => ({ pollita: "Pollita Lu", empanadas: "Good Food Empanadas" }[p.category] || "Línea Gourmet");
    const shortPortion = (p) => String(p.portion || "").split("·")[0].trim();
    const cardTint = (p) => CARD_TINTS[PRODUCTS.indexOf(p) % CARD_TINTS.length];

    function visibleProducts() {
        const terms = normalize(searchTerm).split(/\s+/).filter(Boolean);
        return displayProducts.filter((p) => {
            if (currentCategoryFilter !== "all" && p.category !== currentCategoryFilter) return false;
            const haystack = normalize(`${p.name} ${p.desc} ${lineName(p)}`);
            return terms.every((term) => haystack.includes(term));
        });
    }

    /* El pedido siempre apunta a la presentación elegida cuando el plato tiene varias. */
    function orderState(p) {
        const variant = getActiveVariant(p);
        const id = variant ? variant.id : p.id;
        const item = cart.find((c) => c.id === id);
        const isOut = variant ? (variant.outOfStock === true || variant.available === false) : isProductOut(p);
        return {
            variant,
            id,
            name: variant ? (variant.fullName || p.name) : p.name,
            qty: item ? item.qty : 0,
            isOut,
            canOrder: !isOut && Number.isFinite(p.price) && p.price > 0
        };
    }

    function stepperMarkup(state) {
        return `
            <div class="v2-stepper">
                <button type="button" data-act="dec" aria-label="Quitar una unidad de ${state.name}" onclick="updateQty('${state.id}', ${state.qty - 1})">−</button>
                <span aria-live="polite">${state.qty}</span>
                <button type="button" data-act="inc" aria-label="Agregar una unidad de ${state.name}" onclick="updateQty('${state.id}', ${state.qty + 1})">+</button>
            </div>`;
    }

    function cardFootMarkup(p) {
        const state = orderState(p);
        let control = '<span class="v2-card-out">Sin stock</span>';
        if (state.canOrder && state.qty > 0) control = stepperMarkup(state);
        else if (state.canOrder) control = `<button type="button" class="v2-add" data-act="add" aria-label="Agregar ${state.name} al pedido" onclick="addToCart('${state.id}')">${ICON_PLUS}</button>`;
        return control;
    }

    function cardMarkup(p, index) {
        const isOut = isProductOut(p);
        const eager = index < 4;
        return `
            <article class="v2-card ${p.id === selectedId ? "is-selected" : ""} ${isOut ? "is-out-of-stock" : ""}" data-id="${p.id}" style="--tint:${cardTint(p)}">
                <button type="button" class="v2-card-pick" aria-pressed="${p.id === selectedId}" aria-label="Ver ${p.name}, ${formatPrice(p.price)}" onclick="v2SelectDish('${p.id}')">
                    <span class="v2-card-tag ${isOut ? "is-out" : ""}">${isOut ? "Sin stock" : lineName(p)}</span>
                    <span class="v2-card-plate">
                        <img src="${optimizedImage(p.image, 640)}" data-orig="${p.image}" alt="" width="112" height="112"
                             ${eager ? "" : 'loading="lazy"'} decoding="async" onerror="productImgError(this, '${p.id}')">
                    </span>
                    <span class="v2-card-price" id="v2-price-${p.id}">${formatPrice(p.price)}</span>
                    <span class="v2-card-name">${p.name}</span>
                    <span class="v2-card-portion">${shortPortion(p)}</span>
                </button>
                <div class="v2-card-foot" id="v2-foot-${p.id}">${cardFootMarkup(p)}</div>
            </article>`;
    }

    function orderMarkup(p) {
        const state = orderState(p);
        const price = `<span class="v2-order-price">${formatPrice(p.price)}</span>`;
        if (state.canOrder && state.qty > 0) {
            return `${price}${stepperMarkup(state)}
                <button type="button" class="v2-cta is-quiet" onclick="toggleCart(true)">Ver mi pedido</button>`;
        }
        if (state.canOrder) {
            return `${price}
                <button type="button" class="v2-cta" data-act="add" onclick="addToCart('${state.id}')">
                    Agregar al pedido
                    <span class="v2-cta-icon">${ICON_CART}</span>
                </button>`;
        }
        const message = `Hola! Quería saber cuándo vuelve a estar disponible: ${state.name}.`;
        return `${price}
            <button type="button" class="v2-cta is-quiet" onclick="contactWhatsApp(${JSON.stringify(message).replace(/"/g, "&quot;")})">Sin stock: consultar por WhatsApp</button>`;
    }

    function variantsMarkup(p) {
        const active = getActiveVariant(p);
        return p.variants.map((v) => {
            const isOut = v.outOfStock === true || v.available === false;
            return `<button type="button" class="v2-variant" aria-pressed="${active && active.id === v.id}" ${isOut ? "disabled" : ""}
                            onclick="selectProductVariant('${p.id}', '${v.key}')">${v.shortLabel}${isOut ? " (sin stock)" : ""}</button>`;
        }).join("");
    }

    function showPhoto(p, animate) {
        const src = selectedView === "pack" && p.packImage ? p.packImage : p.image;
        const photo = $("#v2-photo");
        const img = $("#v2-photo-img");
        if (!img || !photo) return;

        $("#v2-showcase").dataset.view = selectedView;
        if (img.dataset.orig !== src) {
            img.dataset.orig = src;
            img.srcset = `${optimizedImage(src, 640)} 640w, ${src} 1000w`;
            img.src = optimizedImage(src, 640);
        }
        img.alt = selectedView === "pack" || !p.packImage && /_vacio\./.test(src) ? `${p.name} envasado al vacío` : `${p.name} servido`;

        if (animate && !prefersReducedMotion) {
            photo.classList.remove("is-turning");
            void photo.offsetWidth;
            photo.classList.add("is-turning");
        }

        $$("#v2-views button").forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.view === selectedView)));
    }

    function renderDish(animate) {
        const p = PRODUCTS.find((item) => item.id === selectedId);
        if (!p) return;
        const variant = getActiveVariant(p);

        $("#v2-dish-name").textContent = p.name;
        $("#v2-dish-desc").textContent = p.desc;
        $("#v2-dish-meta").textContent = `${(variant && variant.portion) || p.portion}. ${(variant && variant.prep) || p.prep}`;

        const variantsBox = $("#v2-variants");
        variantsBox.hidden = !p.variants;
        variantsBox.innerHTML = p.variants ? variantsMarkup(p) : "";

        $("#v2-order").innerHTML = orderMarkup(p);
        $("#v2-views").hidden = !p.packImage;
        if (!p.packImage) selectedView = "dish";
        showPhoto(p, animate);
    }

    function updateArrows() {
        const rail = $("#products-rail");
        if (!rail) return;
        $$(".v2-arrow").forEach((arrow) => {
            const atEdge = arrow.dataset.dir === "-1"
                ? rail.scrollLeft <= 6
                : rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 6;
            arrow.disabled = atEdge;
        });
    }

    function scrollCardIntoRail(id) {
        const rail = $("#products-rail");
        if (!rail) return;
        const card = $(`.v2-card[data-id="${id}"]`, rail);
        if (!card) return;
        const targetLeft = card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2;
        const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
        rail.scrollTo({
            left: Math.max(0, Math.min(maxScroll, targetLeft)),
            behavior: prefersReducedMotion ? "auto" : "smooth"
        });
    }

    function selectDish(id, animate) {
        if (id !== selectedId) selectedView = "dish";
        selectedId = id;
        $$(".v2-card").forEach((card) => {
            const isSelected = card.dataset.id === id;
            card.classList.toggle("is-selected", isSelected);
            $(".v2-card-pick", card).setAttribute("aria-pressed", String(isSelected));
        });
        renderDish(animate);
    }

    let autoRotatePausedUntil = 0;
    let isPointerInsideCatalog = false;

    function pauseAutoRotate(ms = 7000) {
        autoRotatePausedUntil = Date.now() + ms;
    }

    /* La página no se mueve al elegir: en celular se puede tocar otro plato enseguida. */
    window.v2SelectDish = function (id) {
        pauseAutoRotate(9000);
        selectDish(id, true);
        scrollCardIntoRail(id);
    };

    window.renderProducts = function () {
        const rail = $("#products-rail");
        if (!rail) return;
        if (!displayProducts || displayProducts.length === 0) initRandomProductOrder();

        const list = visibleProducts();
        if (list.length === 0) {
            rail.innerHTML = '<div class="v2-empty"><p></p><button type="button" onclick="v2ShowAll()">Ver toda la carta</button></div>';
            $(".v2-empty p", rail).textContent = searchTerm
                ? `No encontramos platos para "${searchTerm}".`
                : "No hay productos disponibles en esta categoría.";
            updateArrows();
            return;
        }

        const keepSelected = list.some((p) => p.id === selectedId);
        const nextId = keepSelected ? selectedId : list[0].id;
        const isChange = selectedId !== null && nextId !== selectedId;
        if (isChange) selectedView = "dish";
        selectedId = nextId;

        rail.innerHTML = list.map(cardMarkup).join("");
        rail.scrollLeft = 0;
        renderDish(isChange);
        updateArrows();
    };

    /* app.js llama a esto al cambiar cantidades o presentación: se actualiza sin redibujar el carrusel. */
    window.refreshCardFooter = function (id) {
        const entry = findCatalogEntry(id);
        const productId = (entry && entry.parentId) || id;
        const product = PRODUCTS.find((p) => p.id === productId);
        if (!product) return false;

        const active = document.activeElement;
        const zone = active && active.closest ? active.closest(".v2-card-foot, #v2-order") : null;
        const zoneSelector = zone ? `#${zone.id}` : null;
        const focusAct = zone ? active.getAttribute("data-act") : null;

        const foot = document.getElementById(`v2-foot-${productId}`);
        if (foot) foot.innerHTML = cardFootMarkup(product);
        const price = document.getElementById(`v2-price-${productId}`);
        if (price) {
            price.textContent = formatPrice(product.price);
            price.closest("button").setAttribute("aria-label", `Ver ${product.name}, ${formatPrice(product.price)}`);
        }
        if (selectedId === productId) renderDish(false);

        if (zoneSelector && focusAct) {
            const scope = $(zoneSelector);
            const target = scope && ($(`[data-act="${focusAct === "add" ? "inc" : focusAct}"]`, scope) || $("button:not([disabled])", scope));
            if (target) target.focus({ preventScroll: true });
        }
        return true;
    };

    window.v2ShowAll = function () {
        searchTerm = "";
        const input = $("#v2-search-input");
        if (input) input.value = "";
        filterCategory("all");
    };

    function setupRail() {
        const rail = $("#products-rail");
        if (!rail) return;
        rail.addEventListener("scroll", () => requestAnimationFrame(updateArrows), { passive: true });
        window.addEventListener("resize", updateArrows, { passive: true });
        $$(".v2-arrow").forEach((arrow) => {
            arrow.addEventListener("click", () => {
                const card = $(".v2-card", rail);
                const step = card ? card.offsetWidth + 16 : 240;
                rail.scrollBy({ left: Number(arrow.dataset.dir) * step, behavior: prefersReducedMotion ? "auto" : "smooth" });
            });
        });
    }

    function setupViews() {
        $$("#v2-views button").forEach((btn) => {
            btn.addEventListener("click", () => {
                selectedView = btn.dataset.view;
                const p = PRODUCTS.find((item) => item.id === selectedId);
                if (p) showPhoto(p, true);
            });
        });
    }

    function setupSearch() {
        const form = $("#v2-search");
        const input = $("#v2-search-input");
        if (!form || !input) return;
        input.addEventListener("input", () => {
            searchTerm = input.value.trim();
            renderProducts();
        });
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            input.blur();
            $("#carta").scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
        });
    }

    function setupMenu() {
        const toggle = $("#v2-menu-toggle");
        const menu = $("#v2-menu");
        if (!toggle || !menu) return;
        const setOpen = (open) => {
            menu.hidden = !open;
            toggle.setAttribute("aria-expanded", String(open));
        };
        toggle.addEventListener("click", () => setOpen(menu.hidden));
        menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
        document.addEventListener("click", (e) => {
            if (!menu.hidden && !menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !menu.hidden) {
                setOpen(false);
                toggle.focus();
            }
        });
    }

    function fillFreeShippingChip() {
        const el = $("#v2-chip-amount");
        if (el) el.textContent = formatPrice(STORE_CONFIG.freeDeliveryThreshold);
    }

    function setupAutoRandomCarousel() {
        const panel = $(".v2-panel");
        const rail = $("#products-rail");
        if (!panel || !rail || prefersReducedMotion) return;

        panel.addEventListener("pointerdown", () => pauseAutoRotate(8000), { passive: true });
        panel.addEventListener("touchstart", () => pauseAutoRotate(8000), { passive: true });
        rail.addEventListener("wheel", () => pauseAutoRotate(6000), { passive: true });
        rail.addEventListener("pointerenter", () => { isPointerInsideCatalog = true; });
        rail.addEventListener("pointerleave", () => { isPointerInsideCatalog = false; });

        setInterval(() => {
            if (document.hidden || isPointerInsideCatalog || Date.now() < autoRotatePausedUntil) return;
            if (document.body.classList.contains("drawer-open")) return;

            const allVisible = visibleProducts();
            const inStock = allVisible.filter((p) => !isProductOut(p));
            const pool = inStock.length > 1 ? inStock : allVisible;
            if (pool.length <= 1) return;

            const candidates = pool.filter((p) => p.id !== selectedId);
            const next = candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
            if (!next) return;

            selectDish(next.id, true);
            scrollCardIntoRail(next.id);
        }, 4000);
    }

    document.addEventListener("DOMContentLoaded", () => {
        setupRail();
        setupViews();
        setupSearch();
        setupMenu();
        fillFreeShippingChip();
        setupAutoRandomCarousel();
    });
})();
