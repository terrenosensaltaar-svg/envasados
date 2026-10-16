/**
 * Mejoras de interfaz para index-mejorado.html.
 * Se carga DESPUÉS de products.js y app.js (defer conserva el orden) y extiende
 * sus funciones globales sin modificar la lógica de carrito ni de pedidos.
 */
(function () {
    "use strict";

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const money = (v) => (typeof formatPrice === "function" ? formatPrice(v) : "$" + Number(v).toLocaleString("es-AR"));

    /* ---------- Toast accesible (anuncia el mensaje a lectores de pantalla) ---------- */
    window.showToast = function (text) {
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.textContent = text;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    };

    /* ---------- Drawer: foco, ESC, bloqueo de scroll e "inert" ---------- */
    const drawer = $("#drawer");
    let lastFocused = null;
    const originalToggleCart = window.toggleCart;

    window.toggleCart = function (open) {
        originalToggleCart(open);
        if (!drawer) return;
        document.body.classList.toggle("drawer-open", !!open);
        drawer.inert = !open;
        drawer.setAttribute("aria-hidden", open ? "false" : "true");
        if (open) {
            lastFocused = document.activeElement;
            setTimeout(() => $(".btn-close", drawer)?.focus(), 60);
        } else if (lastFocused && typeof lastFocused.focus === "function") {
            lastFocused.focus();
            lastFocused = null;
        }
    };

    document.addEventListener("keydown", (e) => {
        if (!drawer || !drawer.classList.contains("active")) return;
        if (e.key === "Escape") {
            window.toggleCart(false);
            return;
        }
        if (e.key !== "Tab") return;
        // Atrapa el foco dentro del drawer mientras está abierto.
        const focusables = $$("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])", drawer)
            .filter((el) => !el.disabled && el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    /* ---------- Barra de progreso hacia el envío gratis ---------- */
    const originalUpdateCartUI = window.updateCartUI;

    function updateShipProgress() {
        const box = $("#ship-progress");
        if (!box) return;
        const subtotal = cart.reduce((sum, item) => {
            const p = PRODUCTS.find((x) => x.id === item.id);
            return sum + (p ? p.price * item.qty : 0);
        }, 0);
        const goal = STORE_CONFIG.freeDeliveryThreshold;
        const text = $("#ship-progress-text", box);
        const bar = $("#ship-progress-bar", box);
        const hidden = cart.length === 0 || deliveryMethod === "pickup";
        box.hidden = hidden;
        if (hidden) return;
        const pct = Math.min(100, Math.round((subtotal / goal) * 100));
        bar.style.width = pct + "%";
        box.setAttribute("aria-valuenow", String(pct));
        text.innerHTML = subtotal >= goal
            ? "🎉 <strong>¡Tu envío es gratis!</strong>"
            : `Te faltan <strong>${money(goal - subtotal)}</strong> para el envío gratis`;
    }

    window.updateCartUI = function () {
        originalUpdateCartUI();
        updateShipProgress();
        const count = cart.reduce((s, i) => s + i.qty, 0);
        const btn = $(".btn-cart");
        if (btn) btn.setAttribute("aria-label", `Abrir mi pedido, ${count} ${count === 1 ? "producto" : "productos"}`);
    };

    /* ---------- Contacto genérico por WhatsApp ---------- */
    window.contactWhatsApp = function (text) {
        const msg = text || "Hola! Quisiera consultar por los productos de Envasados al Vacío Gourmet.";
        window.open(`https://api.whatsapp.com/send?phone=${STORE_CONFIG.whatsappPhone}&text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    };

    /* ---------- Estado accesible de los filtros de categoría ---------- */
    const originalFilterCategory = window.filterCategory;
    window.filterCategory = function (cat, btn) {
        originalFilterCategory(cat, btn);
        $$(".cat-tab").forEach((tab) => tab.setAttribute("aria-pressed", String(tab.dataset.cat === cat)));
    };

    /* ---------- Contadores de las pestañas de categoría ---------- */
    function updateTabCounts() {
        const counts = { all: PRODUCTS.length };
        PRODUCTS.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
        $$(".cat-tab").forEach((tab) => {
            const el = $(".tab-count", tab);
            if (el) el.textContent = counts[tab.dataset.cat] ?? 0;
        });
    }

    /* ---------- Sabores Pollita Lu desde el catálogo (precios siempre al día) ---------- */
    function renderPollitaFlavors() {
        const grid = $("#pollita-flavors");
        if (!grid) return;
        const flavors = PRODUCTS.filter((p) => p.category === "pollita");
        grid.innerHTML = flavors.map((p) => {
            const thumb = p.packImage || p.image;
            return `
                <div class="flavor-item">
                    <img src="${thumb}" alt="${p.name} al vacío" class="flavor-thumb" width="62" height="62" loading="lazy" decoding="async">
                    <div class="flavor-text">
                        <strong>${p.name.replace("Patas Muslo ", "")} · ${money(p.price)} (1Kg)</strong>
                        <span>${p.desc.replace(/ x 1Kg\./, ".")}</span>
                    </div>
                </div>`;
        }).join("");
    }

    /* ---------- Textos dinámicos de envío (única fuente: STORE_CONFIG) ---------- */
    function fillShippingTexts() {
        $$("[data-fee]").forEach((el) => { el.textContent = money(STORE_CONFIG.deliveryFee); });
        $$("[data-free-from]").forEach((el) => { el.textContent = money(STORE_CONFIG.freeDeliveryThreshold); });
    }

    /* ---------- Header con sombra al hacer scroll + animaciones de entrada ---------- */
    function setupScrollEffects() {
        const header = $(".header");
        const onScroll = () => header && header.classList.toggle("is-scrolled", window.scrollY > 8);
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();

        if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
            });
        }, { threshold: 0.12 });
        $$(".trust-item, .step-card, .tip-card, .faq-list details, .pollita-content-box").forEach((el) => {
            el.classList.add("reveal");
            io.observe(el);
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (drawer) { drawer.inert = true; drawer.setAttribute("aria-hidden", "true"); }
        updateTabCounts();
        renderPollitaFlavors();
        fillShippingTexts();
        updateShipProgress();
        setupScrollEffects();
        // Los botones de pestaña de categoría exponen su estado real a lectores de pantalla.
        $$(".cat-tab").forEach((tab) => tab.setAttribute("aria-controls", "products-grid"));
    });
})();
