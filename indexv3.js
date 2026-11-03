/**
 * Catálogo interactivo de indexv3.html.
 * Se carga después de products.js, app.js e index-mejorado.js (defer conserva el orden)
 * y reemplaza solo cómo se dibuja la carta: carrito, stock y pedidos siguen en app.js.
 */
(function () {
    "use strict";

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

    const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    const ICON_CART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L20 8H6"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>';
    const ICON_TRUCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>';

    let selectedId = null;
    let selectedView = "dish";
    let searchTerm = "";

    const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const isProductOut = (p) => p.outOfStock === true || p.available === false;
    const lineName = (p) => (p.category === "pollita" ? "Pollita Lu" : "Gourmet");
    const shortPortion = (p) => String(p.portion || "").split("·")[0].trim();
    // Foto del plato sin fondo (img-recorte/); si falta, se usa la foto original.
    const cutoutImage = (src) => "img-recorte/" + String(src).replace(/\.jpe?g$/i, ".webp");

    function visibleProducts() {
        const terms = normalize(searchTerm).split(/\s+/).filter(Boolean);
        return displayProducts.filter((p) => {
            if (currentCategoryFilter !== "all" && p.category !== currentCategoryFilter) return false;
            const haystack = normalize(`${p.name} ${p.desc} ${lineName(p)}`);
            return terms.every((term) => haystack.includes(term));
        });
    }

    /* El pedido siempre apunta a la presentación elegida (crudas o cocidas) cuando el plato las tiene. */
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
            <div class="v3-stepper">
                <button type="button" data-act="dec" aria-label="Quitar una unidad de ${state.name}" onclick="updateQty('${state.id}', ${state.qty - 1})">−</button>
                <span aria-live="polite">${state.qty}</span>
                <button type="button" data-act="inc" aria-label="Agregar una unidad de ${state.name}" onclick="updateQty('${state.id}', ${state.qty + 1})">+</button>
            </div>`;
    }

    function cardFootMarkup(p) {
        const state = orderState(p);
        let control = '<span class="v3-card-out">Sin stock</span>';
        if (state.canOrder && state.qty > 0) control = stepperMarkup(state);
        else if (state.canOrder) control = `<button type="button" class="v3-add" data-act="add" aria-label="Agregar ${state.name} al pedido" onclick="addToCart('${state.id}')">${ICON_PLUS}</button>`;
        return `<span class="v3-card-price">${formatPrice(p.price)}</span>${control}`;
    }

    function cardMarkup(p, index) {
        const isOut = isProductOut(p);
        const eager = index < 4;
        return `
            <article class="v3-card ${p.id === selectedId ? "is-selected" : ""} ${isOut ? "is-out-of-stock" : ""}" data-id="${p.id}">
                ${isOut ? '<span class="v3-card-tag">Sin stock</span>' : ""}
                <button type="button" class="v3-card-pick" aria-pressed="${p.id === selectedId}" aria-label="Ver ${p.name}" onclick="v3SelectDish('${p.id}')">
                    <span class="v3-card-plate">
                        <img src="${cutoutImage(p.image)}" data-orig="${p.image}" alt="" width="138" height="112"
                             ${eager ? "" : 'loading="lazy"'} decoding="async" onerror="productImgError(this, '${p.id}')">
                    </span>
                    <span class="v3-card-name">${p.name}</span>
                    <span class="v3-card-portion">${shortPortion(p)}</span>
                </button>
                <div class="v3-card-foot" id="v3-foot-${p.id}">${cardFootMarkup(p)}</div>
            </article>`;
    }

    function orderMarkup(p) {
        const state = orderState(p);
        if (state.canOrder && state.qty > 0) {
            return `${stepperMarkup(state)}
                <button type="button" class="v3-cta is-quiet" onclick="toggleCart(true)">Ver mi pedido</button>`;
        }
        if (state.canOrder) {
            return `
                <button type="button" class="v3-cta" data-act="add" onclick="addToCart('${state.id}')">
                    Agregar al pedido
                    <span class="v3-cta-icon">${ICON_CART}</span>
                </button>
                <span class="v3-ship">${ICON_TRUCK}<span>Envío gratis<br>desde <strong>${formatPrice(STORE_CONFIG.freeDeliveryThreshold)}</strong></span></span>`;
        }
        const message = `Hola! Quería saber cuándo vuelve a estar disponible: ${state.name}.`;
        return `<button type="button" class="v3-cta is-quiet" onclick="contactWhatsApp(${JSON.stringify(message).replace(/"/g, "&quot;")})">Sin stock: consultar por WhatsApp</button>`;
    }

    function variantsMarkup(p) {
        const active = getActiveVariant(p);
        return p.variants.map((v) => {
            const isOut = v.outOfStock === true || v.available === false;
            return `<button type="button" class="v3-variant" aria-pressed="${active && active.id === v.id}" ${isOut ? "disabled" : ""}
                            onclick="selectProductVariant('${p.id}', '${v.key}')">${v.shortLabel}${isOut ? " (sin stock)" : ""}</button>`;
        }).join("");
    }

    function showPhoto(p, animate) {
        const isPack = selectedView === "pack" && p.packImage;
        const orig = isPack ? p.packImage : p.image;
        const src = isPack ? optimizedImage(orig, 640) : cutoutImage(orig);
        const photo = $("#v3-photo");
        const img = $("#v3-photo-img");
        if (!img || !photo) return;

        $("#v3-showcase").dataset.view = selectedView;
        if (img.dataset.want !== src) {
            img.dataset.want = src;
            img.dataset.orig = orig;
            img.src = src;
        }
        img.alt = isPack ? `${p.name} envasado al vacío` : `${p.name} servido`;

        if (animate && !prefersReducedMotion) {
            photo.classList.remove("is-turning");
            void photo.offsetWidth;
            photo.classList.add("is-turning");
        }

        $$("#v3-views button").forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.view === selectedView)));
    }

    function renderDish(animate) {
        const p = PRODUCTS.find((item) => item.id === selectedId);
        if (!p) return;
        const variant = getActiveVariant(p);

        $("#v3-sticker").textContent = formatPrice(p.price);
        $("#v3-dish-name").textContent = p.name;
        $("#v3-dish-desc").textContent = p.desc;
        $("#v3-dish-meta").textContent = `${(variant && variant.portion) || p.portion}. ${(variant && variant.prep) || p.prep}`;

        const variantsBox = $("#v3-variants");
        variantsBox.hidden = !p.variants;
        variantsBox.innerHTML = p.variants ? variantsMarkup(p) : "";

        $("#v3-order").innerHTML = orderMarkup(p);
        $("#v3-views").hidden = !p.packImage;
        if (!p.packImage) selectedView = "dish";
        showPhoto(p, animate);
    }

    function updateArrows() {
        const rail = $("#products-rail");
        if (!rail) return;
        $$(".v3-arrow").forEach((arrow) => {
            const atEdge = arrow.dataset.dir === "-1"
                ? rail.scrollLeft <= 6
                : rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 6;
            arrow.disabled = atEdge;
        });
    }

    function selectDish(id, animate) {
        if (id !== selectedId) selectedView = "dish";
        selectedId = id;
        $$(".v3-card").forEach((card) => {
            const isSelected = card.dataset.id === id;
            card.classList.toggle("is-selected", isSelected);
            $(".v3-card-pick", card).setAttribute("aria-pressed", String(isSelected));
        });
        renderDish(animate);
    }

    /* En celular la foto queda debajo de las tarjetas: al tocar un plato se lleva la vista hasta ella. */
    window.v3SelectDish = function (id) {
        selectDish(id, true);
        if (window.matchMedia("(max-width: 900px)").matches) {
            $("#v3-showcase").scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
        }
    };

    window.renderProducts = function () {
        const rail = $("#products-rail");
        if (!rail) return;
        if (!displayProducts || displayProducts.length === 0) initRandomProductOrder();

        const list = visibleProducts();
        if (list.length === 0) {
            rail.innerHTML = '<div class="v3-empty"><p></p><button type="button" onclick="v3ShowAll()">Ver toda la carta</button></div>';
            $(".v3-empty p", rail).textContent = searchTerm
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
        const zone = active && active.closest ? active.closest(".v3-card-foot, #v3-order") : null;
        const zoneSelector = zone ? `#${zone.id}` : null;
        const focusAct = zone ? active.getAttribute("data-act") : null;

        const foot = document.getElementById(`v3-foot-${productId}`);
        if (foot) foot.innerHTML = cardFootMarkup(product);
        if (selectedId === productId) renderDish(false);

        if (zoneSelector && focusAct) {
            const scope = $(zoneSelector);
            const target = scope && ($(`[data-act="${focusAct === "add" ? "inc" : focusAct}"]`, scope) || $("button:not([disabled])", scope));
            if (target) target.focus({ preventScroll: true });
        }
        return true;
    };

    window.v3ShowAll = function () {
        searchTerm = "";
        const input = $("#v3-search-input");
        if (input) input.value = "";
        filterCategory("all");
    };

    function setupRail() {
        const rail = $("#products-rail");
        if (!rail) return;
        rail.addEventListener("scroll", () => requestAnimationFrame(updateArrows), { passive: true });
        window.addEventListener("resize", updateArrows, { passive: true });
        $$(".v3-arrow").forEach((arrow) => {
            arrow.addEventListener("click", () => {
                const card = $(".v3-card", rail);
                const step = card ? card.offsetWidth + 16 : 240;
                rail.scrollBy({ left: Number(arrow.dataset.dir) * step, behavior: prefersReducedMotion ? "auto" : "smooth" });
            });
        });
    }

    function setupViews() {
        $$("#v3-views button").forEach((btn) => {
            btn.addEventListener("click", () => {
                selectedView = btn.dataset.view;
                const p = PRODUCTS.find((item) => item.id === selectedId);
                if (p) showPhoto(p, true);
            });
        });
    }

    function setupSearch() {
        const form = $("#v3-search");
        const input = $("#v3-search-input");
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
        const toggle = $("#v3-menu-toggle");
        const menu = $("#v3-menu");
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

    document.addEventListener("DOMContentLoaded", () => {
        setupRail();
        setupViews();
        setupSearch();
        setupMenu();
    });
})();
