// Catálogo de Productos Gourmet & Caseros al Vacío
const PRODUCTS = [
    {
        id: "prod-01",
        name: "Empanadas Árabes",
        category: "listo",
        price: 7900,
        portion: "Pack 6 unidades",
        badge: "Listas para hornear",
        desc: "Rellenas con carne molida magra seleccionada, cebolla dulce, tomate fresco, limón y especias tradicionales. Masa crujiente y dorada.",
        prep: "12-15 min en horno a 180°C o airfryer.",
        image: "empanadas_arabes.jpg"
    },
    {
        id: "prod-02",
        name: "Pollo al Horno con Papas",
        category: "listo",
        price: 6500,
        portion: "550g · 2 porciones",
        badge: "Cocción lenta al vacío",
        desc: "Presas doradas y jugosas cocinadas al vacío en su propio jugo con romero, pimentón y papas rústicas tiernas.",
        prep: "Calentar bolsa 10 min en agua caliente o dorar 5 min al horno.",
        image: "pollo_al_horno.jpg"
    },
    {
        id: "prod-03",
        name: "Puré de Papas con Solomillo a la Cerveza",
        category: "listo",
        price: 7500,
        portion: "500g · 2 porciones",
        badge: "Plato de autor casero",
        desc: "Medallones de solomillo braseados en reducción de cerveza y fondo aromático, acompañados de puré de papas mantecado sedoso.",
        prep: "10 minutos a baño maría en agua caliente.",
        image: "solomillo_cerveza.jpg"
    },
    {
        id: "prod-04",
        name: "Pollo Condimentado Crudo (Listo para cocer)",
        category: "crudo",
        price: 5900,
        portion: "600g · Marinado al vacío",
        badge: "Para tu sartén o parrilla",
        desc: "Pechuga y trutros sellados al vacío con marinado de limón, romero silvestre, pimentón dulce y ajo. Absorción total de sabores.",
        prep: "Directo a sartén, parrilla u horno por 15-20 min.",
        image: "pollo_marinado_crudo.jpg"
    }
];

// Línea Pollita Lu de Cortes Marinados
const POLLITA_LU_VARIETIES = [
    { name: "Estilo Parrillero", desc: "Sabor intenso, ahumado y jugoso, ideal para fuego o plancha.", icon: "🔥" },
    { name: "Mostaza Ajo y Miel", desc: "Equilibrio agridulce suave, dorado irresistible.", icon: "🍯" },
    { name: "Pimentón Ahumado", desc: "Ajo confitado y especias con toque ahumado vibrante.", icon: "🌶️" },
    { name: "Curry & Nuez Moscada", desc: "Especias orientales aromáticas de perfil suave y envolvente.", icon: "🌿" },
    { name: "Finas Hierbas", desc: "Fresco, verde y natural con romero, tomillo y orégano.", icon: "🌱" },
    { name: "Provenzal Clásico", desc: "Ajo y perejil fresco de huerta, el gran clásico argentino.", icon: "🧄" }
];
