/**
 * Query normalization and language mapping
 * Handles Hinglish, Hindi, and multilingual input
 */

export const LANGUAGE_MAPPING: Record<string, string> = {

  // Articles & pronouns (remove these as stop words)
  muje: '',
  mujhe: '',
  meri: '',
  mere: '',
  aapka: '',
  tumhara: '',
  uska: '',
  uski: '',
  hamara: '',
  humara: '',

  // Particles & prepositions
  ke: '',
  ka: '',
  ki: '',
  ko: '',
  mein: '',
  main: '',
  par: '',
  se: '',
  me: '',
  in: '',
  on: '',
  at: '',
  to: '',

  // Common verbs to remove
  dikho: '',
  dikhao: '',
  chahiye: '',
  chahi: '',
  do: '',
  dena: '',
  de: '',
  dekho: '',
  batao: '',
  bata: '',

  // Quantity/Number words
  under: 'under',
  below: 'under',
  less: 'under',
  than: '',
  upto: 'under',
  tak: 'under',

  // Colors
  lal: 'red',
  safed: 'white',
  nila: 'blue',
  neela: 'blue',
  peela: 'yellow',
  haara: 'green',
  kala: 'black',
  rang: 'color',

  // Size
  chhota: 'small',
  bada: 'large',
  beech: 'medium',

  // Price/Cost
  sasta: 'cheap',
  mehenga: 'expensive',
  costly: 'expensive',
  bekaar: 'cheap',
  accha: 'good',
  bura: 'bad',
  kharab: 'bad',

  // Clothing
  kapda: 'cloth',
  kapde: 'cloth',
  shirt: 'shirt',
  pant: 'pant',
  dhoti: 'wear',
  saree: 'saree',
  kurta: 'kurta',
  tshirt: 'tshirt',
  jeans: 'jeans',

  // Electronics
  mobile: 'phone',
  laptop: 'laptop',
  tablet: 'tablet',
  computer: 'computer',

  // Home & Kitchen
  ghar: 'home',
  bed: 'bed',
  table: 'table',
  cup: 'cup',
  glass: 'glass',
  plate: 'plate',
  bartan: 'dishes',
  kitchen: 'kitchen',

  // Sports
  jim: 'gym',
  gym: 'gym',
  khel: 'sports',
  sports: 'sports',
  fitness: 'fitness',

  // Quality
  premium: 'premium',
  luxury: 'luxury',
  basic: 'basic',
  quality: 'quality',

  // Fashion
  kurti: 'kurti',
  shorts: 'shorts',
  jacket: 'jacket',
  hoodie: 'hoodie',
  sweater: 'sweater',
  blazer: 'blazer',
  lehenga: 'lehenga',
  bra: 'bra',
  chaddi: 'underwear',
  underwear: 'underwear',
  baniyan: 'vest',
  moja: 'socks',
  moje: 'socks',

  // Footwear
  shoe: 'shoes',
  chappal: 'slippers',
  sandal: 'sandals',
  boot: 'boots',
  heel: 'heels',
  sneaker: 'sneakers',
  jute: 'shoes',
  juta: 'shoes',
  jutti: 'shoes',
  hawai: 'flipflops',
  joota: 'shoes',

  // Mobiles
  fon: 'phone',
  iphone: 'iphone',
  samsung: 'samsung phone',
  oneplus: 'oneplus phone',
  realme: 'realme phone',
  oppo: 'oppo phone',
  vivo: 'vivo phone',
  redmi: 'redmi phone',

  // Computers
  macbook: 'macbook',
  pc: 'computer',
  keyboard: 'keyboard',
  mouse: 'mouse',
  monitor: 'monitor',
  printer: 'printer',
  scanner: 'scanner',
  webcam: 'webcam',

  // Electronics
  tv: 'television',
  fridge: 'refrigerator',
  ac: 'air conditioner',
  cooler: 'air cooler',
  washingmachine: 'washing machine',
  microwave: 'microwave oven',
  geyser: 'water heater',
  fan: 'fan',
  speaker: 'speaker',
  earphone: 'earphones',
  headphone: 'headphones',
  earbuds: 'earbuds',
  smartwatch: 'smartwatch',

  // Grocery
  atta: 'flour',
  chawal: 'rice',
  dal: 'lentils',
  chini: 'sugar',
  namak: 'salt',
  chai: 'tea',
  coffee: 'coffee',
  tel: 'oil',
  masala: 'spices',
  biscuit: 'biscuits',
  namkeen: 'snacks',
  chocolate: 'chocolate',

  // Beauty
  sabun: 'soap',
  saboon: 'soap',
  shampoo: 'shampoo',
  conditioner: 'conditioner',
  facewash: 'face wash',
  cream: 'cream',
  lotion: 'lotion',
  perfume: 'perfume',
  deo: 'deodorant',
  lipstick: 'lipstick',

  // Home
  kursi: 'chair',
  sofa: 'sofa',
  palang: 'bed',
  almari: 'wardrobe',
  bistar: 'bed',
  takiya: 'pillow',
  kambal: 'blanket',
  parda: 'curtain',
  bucket: 'bucket',

  // Kitchen
  bottle: 'water bottle',
  // Common Hindi/Hinglish words
  pani: 'water',
  paani: 'water',
  bottel: 'bottle',
  botal: 'bottle',
  cooker: 'pressure cooker',
  kadhai: 'wok',
  pan: 'pan',
  knife: 'knife',
  mixer: 'mixer grinder',

  // Sports
  bat: 'cricket bat',
  ball: 'ball',
  football: 'football',
  cricket: 'cricket equipment',
  dumbbell: 'dumbbell',
  treadmill: 'treadmill',
  cycle: 'bicycle',

  // Baby
  diaper: 'diapers',
  pampers: 'diapers',
  stroller: 'baby stroller',
  babysoap: 'baby soap',
  babyoil: 'baby oil',

  // Pet
  dogfood: 'dog food',
  catfood: 'cat food',
  pettoy: 'pet toy',

  // Automotive
  helmet: 'helmet',
  tyre: 'tire',
  battery: 'battery',
  engineoil: 'engine oil',
  bikecover: 'bike cover',

  // Jewellery
  chain: 'chain',
  haar: 'necklace',
  anguthi: 'ring',
  bali: 'earrings',
  bracelet: 'bracelet',
  payal: 'anklet',
  mangalsutra: 'mangalsutra',
};

// export const SYNONYMS: Record<string, string[]> = {
//   water: ['pani', 'aqua', 'h2o'],
//   bottle: ['bottel', 'botal', 'container', 'flask'],
//   mobile: ['phone', 'cellphone', 'smartphone'],
//   shoes: ['sneakers', 'footwear', 'jute'],
//   tshirt: ['t-shirt', 'shirt', 'tee'],
//   jeans: ['denim', 'pants'],
//   jacket: ['coat', 'blazer'],
//   cheap: ['affordable', 'budget', 'sasta'],
//   expensive: ['costly', 'premium', 'mehenga'],
//   good: ['quality', 'excellent', 'accha'],
//   small: ['tiny', 'compact', 'chhota'],
//   large: ['big', 'huge', 'bada'],
// };

// export const HINGLISH_MAP: Record<string, string> = {
//   pani: 'water',
//   paani: 'water',
//   bottel: 'bottle',
//   botal: 'bottle',
//   jute: 'shoes',
//   juta: 'shoes',
//   lal: 'red',
//   sasta: 'cheap',
//   mehenga: 'expensive',
//   kapda: 'clothes',
//   mobile: 'phone',
//   jim: 'gym',
//   khel: 'sports',
// };

/**
 * Normalize text - apply language mappings and basic preprocessing
 */
export function normalizeText(text: string): string {
  if (!text) return '';

  let normalized = text.toLowerCase().trim();

  // Apply language mappings
  Object.entries(LANGUAGE_MAPPING).forEach(([key, value]) => {
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    normalized = normalized.replace(regex, value);
  });

  // Object.entries(HINGLISH_MAP).forEach(([key, value]) => {
  //   const regex = new RegExp(`\\b${key}\\b`, 'gi');
  //   normalized = normalized.replace(regex, value);
  // });

  // Remove extra whitespace and empty mapped words
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Remove any standalone stop words (empty strings left from mappings)
  normalized = normalized
    .split(' ')
    .filter((word) => word.length > 0)
    .join(' ');

  return normalized;
}

/**
 * Extract price and keywords from query
 * Handles: "under 1000", "less than 5000", "₹1000", "1000 rupee", "budget 5000"
 */
export function extractPriceFromQuery(query: string): {
  price?: number;
  unit?: string;
} {
  if (!query) return {};

  const normalized = query.toLowerCase();

  // Pattern: "under/below/less than/upto [price]"
  let priceMatch = normalized.match(
    /(?:under|below|less\s+than|upto|tak)\s+(\d+)/,
  );
  if (priceMatch) {
    return { price: parseInt(priceMatch[1]), unit: 'less' };
  }

  // Pattern: "[price] rupee/rs/rupees"
  priceMatch = normalized.match(/(\d+)\s*(?:rupee|rs|₹|rupees?)/);
  if (priceMatch) {
    return { price: parseInt(priceMatch[1]), unit: 'exact' };
  }

  // Pattern: "₹[price]"
  priceMatch = normalized.match(/₹\s*(\d+)/);
  if (priceMatch) {
    return { price: parseInt(priceMatch[1]), unit: 'exact' };
  }

  // Pattern: just a number at the end preceded by keywords
  priceMatch = normalized.match(
    /(?:under|budget|within|max|maximum|price)\s+(\d+)/,
  );
  if (priceMatch) {
    return { price: parseInt(priceMatch[1]), unit: 'less' };
  }

  return {};
}

/**
 * Extract search intent and filters from query
 */
export function extractSearchIntent(query: string): {
  normalizedQuery: string;
  cleanedQuery: string;
  priceMax?: number;
  useCase?: string;
} {
  const normalized = normalizeText(query);
  const priceInfo = extractPriceFromQuery(query);

  // Remove price-related words from cleaned query
  const cleaned = normalized
    .replace(/\bunder\b/gi, '')
    .replace(/\bbelow\b/gi, '')
    .replace(/\bless\s+than\b/gi, '')
    .replace(/\bupto\b/gi, '')
    .replace(/\bbudget\b/gi, '')
    .replace(/\bwithin\b/gi, '')
    .replace(/\bmax\b/gi, '')
    .replace(/\bmaximum\b/gi, '')
    .replace(/\brupee\b/gi, '')
    .replace(/\brupees\b/gi, '')
    .replace(/\brs\b/gi, '')
    .replace(/\b₹\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const result: any = {
    normalizedQuery: normalized,
    cleanedQuery: cleaned || normalized,
  };

  if (priceInfo.price) {
    result.priceMax = priceInfo.price;
  }

  // Use case detection
  if (/cheap|affordable|budget|sasta|bekaar/.test(normalized)) {
    result.useCase = 'budget';
  }
  if (/gym|sports|fitness|exercise|jim|khel/.test(normalized)) {
    result.useCase = 'sports';
  }
  if (/casual|party|formal|occasion/.test(normalized)) {
    result.useCase = 'occasion';
  }

  return result;
}

/**
 * Build fuzzy search term for Atlas $search
 */
export function buildFuzzyTerm(query: string): {
  text: string;
  fuzzy: { maxEdits: number };
} {
  return {
    text: query,
    fuzzy: { maxEdits: 2 },
  };
}
