/** Catalogue used by the seed script. Prices are in rupees. */
export interface SeedVariant {
  name: string;
  skuSuffix: string;
  mrp: number;
  sellingPrice: number;
  discountPrice?: number;
  stock: number;
  weightGrams?: number;
  volumeMl?: number;
  minStock?: number;
}

export interface SeedProduct {
  name: string;
  sku: string;
  brand: string;
  category: string;
  subcategory?: string;
  productType: "FOOD" | "OIL" | "PERSONAL_CARE" | "HOUSEHOLD" | "GROCERY" | "OTHER";
  unit: string;
  taxRate: number;
  hsnCode?: string;
  shortDescription: string;
  description: string;
  isFeatured?: boolean;
  /** Food/oil products carry expiry-tracked batches. */
  batched: boolean;
  shelfLifeDays?: number;
  ingredients?: string;
  allergens?: string;
  dietaryInfo?: string;
  storageInstructions?: string;
  oilType?: string;
  extractionMethod?: "COLD_PRESSED" | "WOOD_PRESSED" | "FILTERED" | "REFINED" | "NOT_APPLICABLE";
  packagingType?: string;
  fragrance?: string;
  nutritionalInfo?: Record<string, string>;
  variants: SeedVariant[];
}

export const CATEGORY_TREE: { name: string; children: string[] }[] = [
  {
    name: "Edible Oils",
    children: ["Cold Pressed Oils", "Coconut Oil", "Groundnut Oil", "Sesame Oil", "Other Oils"],
  },
  {
    name: "Health & Nutrition",
    children: ["Health Mix", "Millet Mix", "Nutrition Powder", "Traditional Mixes"],
  },
  { name: "Groceries", children: ["Rice", "Pulses", "Flour", "Spices"] },
  { name: "Personal Care", children: ["Soaps", "Hair Care", "Skin Care"] },
  { name: "Household", children: ["Cleaning", "Utensil Care"] },
  { name: "Snacks", children: ["Chips & Savouries", "Sweets"] },
  { name: "Traditional Foods", children: ["Pickles", "Honey & Spreads"] },
];

export const PRODUCTS: SeedProduct[] = [
  {
    name: "Cold Pressed Groundnut Oil",
    sku: "OIL-GN",
    brand: "Naattu Suvai",
    category: "Edible Oils",
    subcategory: "Groundnut Oil",
    productType: "OIL",
    unit: "bottle",
    taxRate: 5,
    hsnCode: "15081000",
    isFeatured: true,
    batched: true,
    shelfLifeDays: 270,
    shortDescription: "Chekku-pressed groundnut oil with its natural aroma retained.",
    description:
      "Traditionally cold pressed in a wooden chekku at low temperature so the natural aroma, flavour and nutrients of the groundnut are preserved. Unrefined and free from added chemicals.",
    ingredients: "100% groundnut (peanut)",
    allergens: "Contains peanuts",
    dietaryInfo: "Vegetarian, Vegan, Gluten free",
    storageInstructions: "Store in a cool, dry place away from direct sunlight.",
    oilType: "Groundnut",
    extractionMethod: "COLD_PRESSED",
    packagingType: "PET bottle",
    nutritionalInfo: { Energy: "900 kcal/100g", Fat: "100 g", "Saturated Fat": "18 g", Protein: "0 g" },
    variants: [
      { name: "250 ml", skuSuffix: "250ML", mrp: 140, sellingPrice: 120, stock: 60, volumeMl: 250 },
      { name: "500 ml", skuSuffix: "500ML", mrp: 250, sellingPrice: 220, stock: 48, volumeMl: 500 },
      { name: "1 L", skuSuffix: "1L", mrp: 440, sellingPrice: 399, discountPrice: 379, stock: 40, volumeMl: 1000 },
      { name: "2 L", skuSuffix: "2L", mrp: 850, sellingPrice: 760, stock: 18, volumeMl: 2000 },
      { name: "5 L", skuSuffix: "5L", mrp: 2000, sellingPrice: 1800, stock: 8, volumeMl: 5000, minStock: 5 },
    ],
  },
  {
    name: "Cold Pressed Sesame (Gingelly) Oil",
    sku: "OIL-SES",
    brand: "Naattu Suvai",
    category: "Edible Oils",
    subcategory: "Sesame Oil",
    productType: "OIL",
    unit: "bottle",
    taxRate: 5,
    hsnCode: "15155010",
    isFeatured: true,
    batched: true,
    shelfLifeDays: 365,
    shortDescription: "Pure gingelly oil, ideal for South Indian cooking and oil baths.",
    description:
      "Cold pressed from carefully cleaned sesame seeds. Deep amber colour with a nutty aroma — traditionally used for tempering, pickles and weekly oil baths.",
    ingredients: "100% sesame seeds",
    allergens: "Contains sesame",
    dietaryInfo: "Vegetarian, Vegan",
    storageInstructions: "Keep tightly closed in a cool, dark place.",
    oilType: "Sesame",
    extractionMethod: "COLD_PRESSED",
    packagingType: "PET bottle",
    variants: [
      { name: "500 ml", skuSuffix: "500ML", mrp: 280, sellingPrice: 250, stock: 42, volumeMl: 500 },
      { name: "1 L", skuSuffix: "1L", mrp: 520, sellingPrice: 470, stock: 30, volumeMl: 1000 },
    ],
  },
  {
    name: "Virgin Coconut Oil",
    sku: "OIL-COCO",
    brand: "Kerala Grove",
    category: "Edible Oils",
    subcategory: "Coconut Oil",
    productType: "OIL",
    unit: "bottle",
    taxRate: 5,
    hsnCode: "15131100",
    batched: true,
    shelfLifeDays: 540,
    shortDescription: "Unrefined virgin coconut oil for cooking, hair and skin.",
    description:
      "Extracted from fresh coconut milk without heat, retaining the delicate coconut fragrance and medium-chain fatty acids.",
    ingredients: "100% fresh coconut",
    dietaryInfo: "Vegetarian, Vegan",
    storageInstructions: "Solidifies below 24°C — this is natural.",
    oilType: "Coconut",
    extractionMethod: "COLD_PRESSED",
    packagingType: "Glass jar",
    variants: [
      { name: "500 ml", skuSuffix: "500ML", mrp: 360, sellingPrice: 330, stock: 35, volumeMl: 500 },
      { name: "1 L", skuSuffix: "1L", mrp: 690, sellingPrice: 620, stock: 22, volumeMl: 1000 },
    ],
  },
  {
    name: "Wood Pressed Mustard Oil",
    sku: "OIL-MUST",
    brand: "Naattu Suvai",
    category: "Edible Oils",
    subcategory: "Other Oils",
    productType: "OIL",
    unit: "bottle",
    taxRate: 5,
    batched: true,
    shelfLifeDays: 300,
    shortDescription: "Pungent wood pressed mustard oil for pickles and curries.",
    description: "Wood pressed from whole mustard seeds, retaining the sharp pungency prized in North and East Indian cooking.",
    ingredients: "100% mustard seeds",
    dietaryInfo: "Vegetarian, Vegan",
    oilType: "Mustard",
    extractionMethod: "WOOD_PRESSED",
    packagingType: "PET bottle",
    variants: [{ name: "1 L", skuSuffix: "1L", mrp: 330, sellingPrice: 295, stock: 26, volumeMl: 1000 }],
  },
  {
    name: "Traditional Health Mix",
    sku: "HM-TRAD",
    brand: "Amma's Kitchen",
    category: "Health & Nutrition",
    subcategory: "Health Mix",
    productType: "FOOD",
    unit: "pack",
    taxRate: 5,
    isFeatured: true,
    batched: true,
    shelfLifeDays: 180,
    shortDescription: "Sathu maavu made from 18 roasted grains, pulses and nuts.",
    description:
      "A traditional sathu maavu blend of roasted whole grains, millets, pulses and nuts. Stir into hot water or milk for a wholesome porridge — suitable for growing children and elders.",
    ingredients:
      "Ragi, wheat, barley, maize, green gram, bengal gram, horse gram, groundnut, cashew, almond, cardamom",
    allergens: "Contains nuts, gluten",
    dietaryInfo: "Vegetarian",
    storageInstructions: "Store in an airtight container in a cool, dry place.",
    nutritionalInfo: { Energy: "378 kcal/100g", Protein: "13.5 g", Carbohydrate: "64 g", Fat: "7.2 g", Fibre: "6 g" },
    variants: [
      { name: "500 g", skuSuffix: "500G", mrp: 240, sellingPrice: 220, stock: 55, weightGrams: 500 },
      { name: "1 kg", skuSuffix: "1KG", mrp: 460, sellingPrice: 420, stock: 32, weightGrams: 1000 },
    ],
  },
  {
    name: "Multi Millet Mix",
    sku: "HM-MILLET",
    brand: "Amma's Kitchen",
    category: "Health & Nutrition",
    subcategory: "Millet Mix",
    productType: "FOOD",
    unit: "pack",
    taxRate: 5,
    batched: true,
    shelfLifeDays: 180,
    shortDescription: "Nine millets roasted and stone ground for daily porridge.",
    description: "A balanced blend of nine millets — kambu, thinai, varagu, samai, kuthiraivali and more — roasted and stone ground.",
    ingredients: "Pearl millet, foxtail millet, kodo millet, little millet, barnyard millet, ragi, jowar, sorghum, brown top millet",
    dietaryInfo: "Vegetarian, Gluten free",
    variants: [
      { name: "500 g", skuSuffix: "500G", mrp: 220, sellingPrice: 199, stock: 44, weightGrams: 500 },
      { name: "1 kg", skuSuffix: "1KG", mrp: 420, sellingPrice: 385, stock: 20, weightGrams: 1000 },
    ],
  },
  {
    name: "Ragi Health Mix",
    sku: "HM-RAGI",
    brand: "Amma's Kitchen",
    category: "Health & Nutrition",
    subcategory: "Nutrition Powder",
    productType: "FOOD",
    unit: "pack",
    taxRate: 5,
    batched: true,
    shelfLifeDays: 150,
    shortDescription: "Sprouted finger millet powder, rich in calcium and iron.",
    description: "Finger millet is sprouted, sun dried and roasted before grinding — a gentle first porridge for babies and a calcium-rich drink for adults.",
    ingredients: "Sprouted ragi (finger millet), cardamom",
    dietaryInfo: "Vegetarian, Gluten free",
    variants: [{ name: "500 g", skuSuffix: "500G", mrp: 190, sellingPrice: 170, stock: 38, weightGrams: 500 }],
  },
  {
    name: "Herbal Bath Soap",
    sku: "SOAP-HERB",
    brand: "Vanam Naturals",
    category: "Personal Care",
    subcategory: "Soaps",
    productType: "PERSONAL_CARE",
    unit: "piece",
    taxRate: 18,
    hsnCode: "34011190",
    batched: false,
    shortDescription: "Cold processed herbal soap with neem, tulsi and turmeric.",
    description: "A handmade cold-process soap enriched with neem, tulsi and turmeric, poured in small batches and cured for four weeks.",
    ingredients: "Coconut oil, neem oil, tulsi extract, turmeric, shea butter, sodium hydroxide",
    fragrance: "Neem & Tulsi",
    variants: [
      { name: "100 g", skuSuffix: "100G", mrp: 80, sellingPrice: 70, stock: 120, weightGrams: 100 },
      { name: "Pack of 3", skuSuffix: "PK3", mrp: 230, sellingPrice: 189, stock: 60, weightGrams: 300 },
      { name: "Pack of 6", skuSuffix: "PK6", mrp: 450, sellingPrice: 359, stock: 30, weightGrams: 600 },
    ],
  },
  {
    name: "Natural Handmade Soap",
    sku: "SOAP-NAT",
    brand: "Vanam Naturals",
    category: "Personal Care",
    subcategory: "Soaps",
    productType: "PERSONAL_CARE",
    unit: "piece",
    taxRate: 18,
    batched: false,
    shortDescription: "Gentle sandal and rose soap for everyday use.",
    description: "A mild handmade soap with sandalwood and rose, suitable for sensitive skin.",
    ingredients: "Coconut oil, castor oil, sandalwood powder, rose extract, glycerin",
    fragrance: "Sandal & Rose",
    variants: [
      { name: "100 g", skuSuffix: "100G", mrp: 90, sellingPrice: 78, stock: 95, weightGrams: 100 },
      { name: "Pack of 3", skuSuffix: "PK3", mrp: 260, sellingPrice: 215, stock: 40, weightGrams: 300 },
    ],
  },
  {
    name: "Wild Forest Honey",
    sku: "HON-WILD",
    brand: "Hill Harvest",
    category: "Traditional Foods",
    subcategory: "Honey & Spreads",
    productType: "FOOD",
    unit: "jar",
    taxRate: 5,
    isFeatured: true,
    batched: true,
    shelfLifeDays: 730,
    shortDescription: "Raw, unprocessed honey gathered from forest hives.",
    description: "Collected by tribal honey gatherers from wild hives and only coarse filtered — never heated, so natural enzymes and pollen remain.",
    ingredients: "100% raw wild honey",
    dietaryInfo: "Vegetarian, Gluten free",
    storageInstructions: "Natural crystallisation is a sign of purity. Do not refrigerate.",
    variants: [
      { name: "250 g", skuSuffix: "250G", mrp: 260, sellingPrice: 240, stock: 46, weightGrams: 250 },
      { name: "500 g", skuSuffix: "500G", mrp: 480, sellingPrice: 440, stock: 28, weightGrams: 500 },
      { name: "1 kg", skuSuffix: "1KG", mrp: 900, sellingPrice: 820, stock: 12, weightGrams: 1000 },
    ],
  },
  {
    name: "Traditional Wheat Flour",
    sku: "FLR-WHEAT",
    brand: "Naattu Suvai",
    category: "Groceries",
    subcategory: "Flour",
    productType: "GROCERY",
    unit: "pack",
    taxRate: 5,
    batched: true,
    shelfLifeDays: 120,
    shortDescription: "Stone ground whole wheat atta with the bran retained.",
    description: "Whole wheat stone ground in small batches so the bran and germ are retained, giving soft rotis with a nutty flavour.",
    ingredients: "100% whole wheat",
    allergens: "Contains gluten",
    variants: [
      { name: "1 kg", skuSuffix: "1KG", mrp: 70, sellingPrice: 62, stock: 80, weightGrams: 1000 },
      { name: "5 kg", skuSuffix: "5KG", mrp: 330, sellingPrice: 295, stock: 26, weightGrams: 5000 },
    ],
  },
  {
    name: "Sona Masoori Rice",
    sku: "RICE-SONA",
    brand: "Field Fresh",
    category: "Groceries",
    subcategory: "Rice",
    productType: "GROCERY",
    unit: "bag",
    taxRate: 5,
    batched: true,
    shelfLifeDays: 365,
    shortDescription: "Lightweight aromatic rice, aged for twelve months.",
    description: "Premium Sona Masoori, aged a full year so the grains cook fluffy and separate.",
    ingredients: "Sona Masoori rice",
    dietaryInfo: "Vegetarian, Gluten free",
    variants: [
      { name: "5 kg", skuSuffix: "5KG", mrp: 420, sellingPrice: 385, stock: 34, weightGrams: 5000 },
      { name: "25 kg", skuSuffix: "25KG", mrp: 1950, sellingPrice: 1820, stock: 9, weightGrams: 25000, minStock: 5 },
    ],
  },
  {
    name: "Organic Toor Dal",
    sku: "PUL-TOOR",
    brand: "Field Fresh",
    category: "Groceries",
    subcategory: "Pulses",
    productType: "GROCERY",
    unit: "pack",
    taxRate: 5,
    batched: true,
    shelfLifeDays: 300,
    shortDescription: "Unpolished organic toor dal with no added oil.",
    description: "Certified organic pigeon peas, unpolished and free from the oil coating used to make dal look glossy.",
    ingredients: "Organic toor dal (pigeon pea)",
    dietaryInfo: "Vegetarian, Vegan, Gluten free",
    variants: [
      { name: "500 g", skuSuffix: "500G", mrp: 110, sellingPrice: 98, stock: 70, weightGrams: 500 },
      { name: "1 kg", skuSuffix: "1KG", mrp: 210, sellingPrice: 188, stock: 40, weightGrams: 1000 },
    ],
  },
  {
    name: "Organic Turmeric Powder",
    sku: "SPC-TURM",
    brand: "Hill Harvest",
    category: "Groceries",
    subcategory: "Spices",
    productType: "GROCERY",
    unit: "pack",
    taxRate: 5,
    batched: true,
    shelfLifeDays: 365,
    shortDescription: "High-curcumin Salem turmeric, sun dried and stone ground.",
    description: "Salem turmeric fingers, sun dried and stone ground with no colour or starch added.",
    ingredients: "100% turmeric",
    dietaryInfo: "Vegetarian, Vegan, Gluten free",
    variants: [
      { name: "100 g", skuSuffix: "100G", mrp: 70, sellingPrice: 60, stock: 85, weightGrams: 100 },
      { name: "250 g", skuSuffix: "250G", mrp: 160, sellingPrice: 140, stock: 50, weightGrams: 250 },
    ],
  },
  {
    name: "Mixed Vegetable Pickle",
    sku: "PKL-MIX",
    brand: "Amma's Kitchen",
    category: "Traditional Foods",
    subcategory: "Pickles",
    productType: "FOOD",
    unit: "jar",
    taxRate: 12,
    batched: true,
    shelfLifeDays: 270,
    shortDescription: "Home-style mixed pickle in gingelly oil.",
    description: "Seasonal vegetables cured in salt and sun, then tempered with home-ground masala and gingelly oil.",
    ingredients: "Mixed vegetables, gingelly oil, salt, chilli powder, mustard, fenugreek, asafoetida",
    allergens: "Contains mustard, sesame",
    dietaryInfo: "Vegetarian",
    variants: [
      { name: "250 g", skuSuffix: "250G", mrp: 150, sellingPrice: 135, stock: 42, weightGrams: 250 },
      { name: "500 g", skuSuffix: "500G", mrp: 280, sellingPrice: 255, stock: 24, weightGrams: 500 },
    ],
  },
  {
    name: "Kerala Banana Chips",
    sku: "SNK-BANANA",
    brand: "Kerala Grove",
    category: "Snacks",
    subcategory: "Chips & Savouries",
    productType: "FOOD",
    unit: "pack",
    taxRate: 12,
    batched: true,
    shelfLifeDays: 90,
    shortDescription: "Nendran banana chips fried in coconut oil.",
    description: "Hand-sliced Nendran bananas fried in pure coconut oil and lightly salted.",
    ingredients: "Nendran banana, coconut oil, salt",
    dietaryInfo: "Vegetarian, Gluten free",
    variants: [{ name: "150 g", skuSuffix: "150G", mrp: 90, sellingPrice: 80, stock: 65, weightGrams: 150 }],
  },
  {
    name: "Herbal Dishwash Bar",
    sku: "HH-DISH",
    brand: "Vanam Naturals",
    category: "Household",
    subcategory: "Utensil Care",
    productType: "HOUSEHOLD",
    unit: "piece",
    taxRate: 18,
    batched: false,
    shortDescription: "Lemon and soapnut dishwash bar that is gentle on hands.",
    description: "A plant-based dishwash bar made with soapnut and lemon that cuts grease without drying your hands.",
    ingredients: "Soapnut extract, lemon oil, coconut oil derivatives",
    fragrance: "Lemon",
    variants: [
      { name: "Single bar", skuSuffix: "1PC", mrp: 45, sellingPrice: 38, stock: 140, weightGrams: 250 },
      { name: "Pack of 3", skuSuffix: "PK3", mrp: 130, sellingPrice: 105, stock: 55, weightGrams: 750 },
    ],
  },
];

export const CUSTOMERS = [
  { name: "Lakshmi Narayanan", phone: "9840012345", email: "lakshmi.n@example.com", city: "Chennai", state: "Tamil Nadu", line1: "12 Gandhi Street, T Nagar", postalCode: "600017" },
  { name: "Ravi Shankar", phone: "9840023456", email: "ravi.shankar@example.com", city: "Chennai", state: "Tamil Nadu", line1: "45 Bharathi Salai, Mylapore", postalCode: "600004" },
  { name: "Priya Venkatesh", phone: "9840034567", email: "priya.v@example.com", city: "Coimbatore", state: "Tamil Nadu", line1: "8 Kamaraj Road, RS Puram", postalCode: "641002" },
  { name: "Anand Kumar", phone: "9840045678", city: "Madurai", state: "Tamil Nadu", line1: "23 Temple Street", postalCode: "625001" },
  { name: "Meena Sundaram", phone: "9840056789", email: "meena.s@example.com", city: "Chennai", state: "Tamil Nadu", line1: "77 Anna Nagar West", postalCode: "600040" },
  { name: "Karthik Raja", phone: "9840067890", city: "Salem", state: "Tamil Nadu", line1: "5 Market Road", postalCode: "636001" },
  { name: "Divya Balaji", phone: "9840078901", email: "divya.b@example.com", city: "Chennai", state: "Tamil Nadu", line1: "31 Velachery Main Road", postalCode: "600042" },
  { name: "Suresh Babu", phone: "9840089012", city: "Trichy", state: "Tamil Nadu", line1: "19 Cantonment", postalCode: "620001" },
  { name: "Geetha Raman", phone: "9840090123", email: "geetha.r@example.com", city: "Chennai", state: "Tamil Nadu", line1: "64 Adyar Bridge Road", postalCode: "600020" },
  { name: "Walk-in Customer", phone: "9000000000", city: "Chennai", state: "Tamil Nadu", line1: "Store counter", postalCode: "600017" },
];

export const COUPONS = [
  { code: "WELCOME10", description: "10% off your first order", discountType: "PERCENTAGE" as const, discountValue: 10, minOrderValue: 500, maxDiscount: 150, usageLimit: 500, days: 90 },
  { code: "FLAT50", description: "Flat ₹50 off orders above ₹750", discountType: "FIXED_AMOUNT" as const, discountValue: 50, minOrderValue: 750, maxDiscount: null, usageLimit: 200, days: 60 },
  { code: "OILFEST", description: "15% off during the oil festival", discountType: "PERCENTAGE" as const, discountValue: 15, minOrderValue: 1000, maxDiscount: 300, usageLimit: 100, days: 30 },
  { code: "HEALTH20", description: "₹20 off health mixes", discountType: "FIXED_AMOUNT" as const, discountValue: 20, minOrderValue: 300, maxDiscount: null, usageLimit: null, days: 120 },
  { code: "EXPIRED5", description: "Lapsed launch offer", discountType: "PERCENTAGE" as const, discountValue: 5, minOrderValue: 200, maxDiscount: 100, usageLimit: 50, days: -10 },
];
