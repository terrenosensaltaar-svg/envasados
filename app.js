/**
 * App para Envasados al Vacío Gourmet & Caseros - Sé tu propio Chef
 */

// Teléfono fijo inmutable (Salta, Argentina: 387 228 4536)
const STORE_CONFIG = Object.freeze({
    storeName: "Envasados al Vacío Gourmet",
    whatsappPhone: "5493872284536",
    deliveryFee: 2500,
    freeDeliveryThreshold: 25000
});

// Limpiar configuraciones previas de localStorage para garantizar el número fijo
localStorage.removeItem("env_config");

let cart = JSON.parse(localStorage.getItem("env_cart")) || [];
let deliveryMethod = "delivery"; // "delivery" o "pickup"

function formatPrice(val) {
    return `$${Number(val).toLocaleString('es-AR')}`;
}

document.addEventListener("DOMContentLoaded", () => {
    renderProducts();
    updateCartUI();
});

function renderProducts() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    grid.innerHTML = PRODUCTS.map(p => {
        const item = cart.find(c => c.id === p.id);
        const qty = item ? item.qty : 0;

        return `
            <article class="card">
                <div class="card-img-wrap">
                    <img src="${p.image}" alt="${p.name}" class="card-img" width="500" height="375" loading="lazy" decoding="async">
                    <span class="card-badge">${p.badge}</span>
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
                        <span class="card-price">${formatPrice(p.price)}</span>
                        ${qty > 0 ? `
                            <div class="qty-control">
                                <button class="qty-btn" onclick="updateQty('${p.id}', ${qty - 1})">−</button>
                                <span class="qty-val">${qty}</span>
                                <button class="qty-btn" onclick="updateQty('${p.id}', ${qty + 1})">+</button>
                            </div>
                        ` : `
                            <button class="btn-add" onclick="addToCart('${p.id}')">+ Agregar</button>
                        `}
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

function addToCart(id) {
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
    localStorage.setItem("env_cart", JSON.stringify(cart));
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
    const whatsappWindow = window.open("about:blank", "_blank");
    const submitButton = document.querySelector(".btn-whatsapp-send");

    if (!window.supabaseClient) {
        whatsappWindow?.close();
        alert("No se pudo conectar con el sistema de pedidos. Intenta nuevamente en unos minutos.");
        return;
    }

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
    }

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
                    name: product.name,
                    quantity: item.qty,
                    unit_price: product.price
                };
            }),
            subtotal,
            shipping,
            total
        });

        if (error) throw error;

        if (whatsappWindow) {
            whatsappWindow.location.href = url;
        } else {
            window.location.href = url;
        }
    } catch (error) {
        whatsappWindow?.close();
        console.error("No se pudo guardar el pedido:", error);
        alert("No se pudo guardar tu pedido. Revisa tu conexión e intenta nuevamente; todavía no se envió por WhatsApp.");
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.removeAttribute("aria-busy");
        }
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
