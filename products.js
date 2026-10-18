// Catálogo Oficial de Productos Gourmet & Pollita Lu al Vacío
const PRODUCTS = [
    // =========================================================================
    // 1. EMPANADAS GOURMET (LISTAS PARA HORNEAR)
    // =========================================================================
    {
        id: "gm-01",
        name: "Empanadas Árabes",
        category: "gourmet",
        price: 10000,
        portion: "Media docena (6 unidades) · Listas para hornear",
        badge: "Línea Gourmet · Pack x 6 u.",
        desc: "Pack de 6 empanadas abiertas triangulares (fatay) rellenas con carne molida magra seleccionada, cebolla dulce, tomate fresco, limón y especias tradicionales árabes. Masa crujiente y dorada.",
        prep: "12-15 min en horno a 180°C o airfryer.",
        image: "empanadas_arabes.jpg",
        packImage: "empanadas_arabes_vacio.jpg",
        icon: "🥟",
        available: true
    },
    {
        id: "gm-02",
        name: "Empanadas de Carne",
        category: "gourmet",
        price: 10000,
        portion: "Media docena (6 unidades) · Listas para hornear",
        badge: "Línea Gourmet · Pack x 6 u.",
        desc: "Pack de 6 empanadas criollas tradicionales con carne vacuna seleccionada cortada a cuchillo, cebolla de verdeo, pimientos, huevo duro y condimentos caseros.",
        prep: "12-15 min en horno a 200°C hasta dorar.",
        image: "empanadas_de_carne.jpg",
        packImage: "empanadas_de_carne_vacio.jpg",
        icon: "🥟",
        available: true
    },

    // =========================================================================
    // 2. LÍNEA POLLITA LU: PATAS MUSLO SABORIZADAS AL VACÍO
    // =========================================================================
    {
        id: "pl-01",
        name: "Patas Muslo Parrillera",
        category: "pollita",
        price: 10000,
        portion: "Bolsa x 1 Kg · Sellada al vacío",
        badge: "Pollita Lu · Para cocinar",
        desc: "Limón, ajo y chimichurri artesanal x 1Kg. Presas seleccionadas marinadas al vacío, jugosas y listas para dorar a la parrilla, plancha u horno.",
        prep: "Directo a fuego, plancha u horno por 20-25 min.",
        image: "patas_muslo_parrillera.jpg",
        packImage: "patas_muslo_parrillera_vacio.jpg",
        icon: "🍗",
        available: true
    },
    {
        id: "pl-02",
        name: "Patas Muslo Honey",
        category: "pollita",
        price: 12500,
        portion: "Bolsa x 1 Kg · Sellada al vacío",
        badge: "Pollita Lu · Para cocinar",
        desc: "Mostaza, ajo y miel natural x 1Kg. Marinado agridulce que carameliza con un dorado irresistible al cocinar.",
        prep: "Horno a 180°C o sartén tapada por 20-25 min.",
        image: "patas_muslo_honey.jpg",
        packImage: "patas_muslo_honey_vacio.jpg",
        icon: "🍯",
        available: true
    },
    {
        id: "pl-03",
        name: "Patas Muslo Oriental Árabe",
        category: "pollita",
        price: 12000,
        portion: "Bolsa x 1 Kg · Sellada al vacío",
        badge: "Pollita Lu · Para cocinar",
        desc: "Salsa de soja, pimienta árabe, comino y limón x 1Kg. Sabor exótico, aromático y especiado con toque cítrico.",
        prep: "Salteado, horno o plancha caliente 20 min.",
        image: "patas_muslo_oriental.jpg",
        packImage: "patas_muslo_oriental_vacio.jpg",
        icon: "🍋",
        available: true
    },
    {
        id: "pl-04",
        name: "Patas Muslo Ahumada",
        category: "pollita",
        price: 12000,
        portion: "Bolsa x 1 Kg · Sellada al vacío",
        badge: "Pollita Lu · Para cocinar",
        desc: "Pimentón ahumado, comino, ajo y vino blanco x 1Kg. Perfil ahumado profundo y piel crocante al dorar.",
        prep: "Cocción a la parrilla u horno medio 20-25 min.",
        image: "patas_muslo_ahumada.jpg",
        packImage: "patas_muslo_ahumada_vacio.jpg",
        icon: "🔥",
        available: true
    },
    {
        id: "pl-05",
        name: "Patas Muslo Barbacoa Smoky",
        category: "pollita",
        price: 12500,
        portion: "Bolsa x 1 Kg · Sellada al vacío",
        badge: "Pollita Lu · Para cocinar",
        desc: "Salsa barbacoa base, toque de azúcar mascabo o miel, salsa inglesa, pimentón ahumado y un toque de vinagre de manzana x 1Kg.",
        prep: "Horno o sartén dorando al final para glasear 20-25 min.",
        image: "patas_muslo_barbacoa.jpg",
        packImage: "patas_muslo_barbacoa_vacio.jpg",
        icon: "🍖",
        available: true
    },

    // =========================================================================
    // 3. PRODUCTOS SIN STOCK (AL FINAL)
    // =========================================================================
    {
        id: "gm-03",
        name: "Lazaña de Novillo",
        category: "gourmet",
        price: 12500,
        portion: "500g · Porción individual generosa",
        badge: "Sin Stock",
        desc: "Capas artesanales de masa al huevo intercaladas con abundante ragú de novillo braseado, salsa de tomate casera y gratén de queso fundido.",
        prep: "10 min a baño maría en bolsa o 8 min al horno para gratinar.",
        image: "lasana_casera.jpg",
        icon: "🍝",
        available: false,
        outOfStock: true
    },
    {
        id: "gm-04",
        name: "Pastel de Papa",
        category: "gourmet",
        price: 12000,
        portion: "500g · Porción individual generosa",
        badge: "Sin Stock",
        desc: "Puré de papas mantecado y cremoso sobre una base sabrosa y jugosa de carne vacuna sazonada con huevo duro, aceitunas y pimientos, gratinado al horno.",
        prep: "10 min a baño maría en bolsa o gratinar 6 min al horno.",
        image: "pastel_de_papa.jpg",
        icon: "🥧",
        available: false,
        outOfStock: true
    }
];

// Mapeo retrocompatible para carritos guardados en localStorage
const LEGACY_ID_MAP = {
    "prod-01": "gm-01",
    "prod-19": "gm-02",
    "prod-14": "gm-03",
    "prod-18": "gm-04",
    "prod-04": "pl-01"
};

// Variedades Pollita Lu para la sección informativa al pie
const POLLITA_LU_VARIETIES = [
    { name: "Parrillera", desc: "Limón, ajo y chimichurri artesanal x 1Kg ($10.000).", icon: "🔥" },
    { name: "Honey", desc: "Mostaza, ajo y miel caramelizada ($12.500).", icon: "🍯" },
    { name: "Oriental Árabe", desc: "Salsa de soja, pimienta árabe, comino y limón ($12.000).", icon: "🍋" },
    { name: "Ahumada", desc: "Pimentón ahumado, comino, ajo y vino blanco ($12.000).", icon: "🌶️" },
    { name: "Barbacoa Smoky", desc: "Salsa barbacoa base, azúcar mascabo, salsa inglesa y vinagre ($12.500).", icon: "🍖" }
];
