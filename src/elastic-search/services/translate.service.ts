import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class TranslateService {
  private axiosInstance: AxiosInstance;
  private apiKey: string;

  constructor(private readonly configService: ConfigService) {
    const baseURL =
      this.configService.get<string>('GOOGLE_TRANSLATOR_URL') ||
      'https://translation.googleapis.com';

    this.apiKey = this.configService.get<string>('GOOGLE_TRANSLATE_KEY') || '';

    this.axiosInstance = axios.create({
      baseURL,
      timeout: 8000,
    });

    // 🔥 Interceptor → automatically attach API key
    this.axiosInstance.interceptors.request.use((config) => {
      config.params = {
        ...(config.params || {}),
        key: this.apiKey,
      };
      return config;
    });
  }

  // 🌍 Language Detection (basic heuristic)
  detectLanguage(text: string): string {
    const hindiPattern = /[\u0900-\u097F]/;
    const arabicPattern = /[\u0600-\u06FF]/;
    const chinesePattern = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
    const bengaliPattern = /[\u0980-\u09FF]/;
    const teluguPattern = /[\u0C60-\u0C7F]/;
    const tamilPattern = /[\u0B80-\u0BFF]/;
    const malayalamPattern = /[\u0D00-\u0D7F]/;
    const kannadaPattern = /[\u0C80-\u0CFF]/;
    const gujaratiPattern = /[\u0A80-\u0AFF]/;
    const cyrillicPattern = /[\u0400-\u04FF]/;

    if (hindiPattern.test(text)) return 'hi';
    if (arabicPattern.test(text)) return 'ar';
    if (chinesePattern.test(text)) return 'zh';
    if (bengaliPattern.test(text)) return 'bn';
    if (teluguPattern.test(text)) return 'te';
    if (tamilPattern.test(text)) return 'ta';
    if (malayalamPattern.test(text)) return 'ml';
    if (kannadaPattern.test(text)) return 'kn';
    if (gujaratiPattern.test(text)) return 'gu';
    if (cyrillicPattern.test(text)) return 'auto';

    // Catch-all: if the text contains any non-ASCII/non-Latin characters, default to auto-detection
    if (/[^\x00-\xFF]/.test(text)) {
      return 'auto';
    }

    return 'en';
  }

  normalizeLang(lang: string): string {
    return lang.split('-')[0];
  }

  // 🔥 Main Google Translate API Call
  async callGoogleTranslateAPI(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<string> {
    try {
      if (!this.apiKey) {
        console.warn('[TranslateService] Missing API key → using fallback');
        return this.translateUsingFreeEndpoint(text, sourceLang, targetLang);
      }

      const response = await this.axiosInstance.post(
        '/language/translate/v2',
        {},
        {
          params: {
            q: text,
            source: sourceLang,
            target: targetLang,
            format: 'text',
          },
        },
      );

      return response.data?.data?.translations?.[0]?.translatedText || text;
    } catch (error: any) {
      console.warn(
        '[TranslateService] Google API failed → fallback',
        error?.message,
      );
      return this.translateUsingFreeEndpoint(text, sourceLang, targetLang);
    }
  }

  // 🧹 Query Cleaning (stopwords removal)
  async preprocessQuery(query: string, language: string): Promise<string> {
    const processed = query.trim();

    const stopwords: Record<string, string[]> = {
      en: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'at', 'on', 'for'],
      hi: ['का', 'की', 'के', 'है', 'हैं', 'और', 'या', 'लेकिन', 'में', 'पर'],
    };

    const langStopwords = stopwords[language] || stopwords['en'];

    const words = processed.split(/\s+/);

    const filtered = words.filter((word) => {
      const clean = word.toLowerCase().replace(/[^\w\u0900-\u097F]/g, '');
      return clean && !langStopwords.includes(clean);
    });

    return filtered.join(' ').replace(/\s+/g, ' ').trim();
  }

  // 🆓 Free fallback API (Google Translate GTX)
  async translateUsingFreeEndpoint(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<string> {
    try {
      const encodedText = encodeURIComponent(text);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodedText}`;

      const response = await axios.get(url, { timeout: 8000 });
      return response.data?.[0]?.[0]?.[0] || text;
    } catch (error: any) {
      console.warn('[TranslateService] Free API failed', error?.message);
      return text;
    }
  }

  // Local Romanized Hinglish/Banglish dictionary for common terms
  private readonly hinglishDict: Record<string, string> = {
    chaddi: 'underwear',
    chaddis: 'underwear',
    ladka: 'boy',
    larka: 'boy',
    ladki: 'girl',
    larki: 'girl',

    // Kids
    baccha: 'kid',
    bacha: 'kid',
    bacche: 'kids',
    bache: 'kids',

    // Accessories
    ghadi: 'watch',
    watch: 'watch',
    chashma: 'spectacles',
    chasma: 'spectacles',
    belt: 'belt',
    purse: 'wallet',
    batua: 'wallet',
    bag: 'bag',

    // Home
    kursi: 'chair',
    meja: 'table',
    mez: 'table',
    palang: 'bed',
    bistar: 'bed',
    kambal: 'blanket',
    takiya: 'pillow',

    // Food
    mithai: 'sweets',
    laddoo: 'laddu',
    laddu: 'laddu',
    biscuit: 'biscuits',
    chocolate: 'chocolate',
    namkeen: 'snacks',

    // Jewelry
    haar: 'necklace',
    chain: 'chain',
    anguthi: 'ring',
    ring: 'ring',
    bali: 'earrings',


    // Personal Care
    sabun: 'soap',
    saban: 'soap',
    saboon: 'soap',
    shampoo: 'shampoo',
    teli: 'oil',
    cream: 'cream',
    lotion: 'lotion',
    toothpaste: 'toothpaste',
    brush: 'toothbrush',

    // Grocery
    chawal: 'rice',
    atta: 'flour',
    dal: 'lentils',
    tel: 'oil',
    chini: 'sugar',
    namak: 'salt',
    masala: 'spices',
    chai: 'tea',
    coffee: 'coffee',

    // Electronics
    mobile: 'phone',
    phone: 'phone',
    fon: 'phone',
    laptop: 'laptop',
    computer: 'computer',
    pc: 'computer',
    tv: 'television',
    television: 'television',
    fridge: 'refrigerator',
    ac: 'air conditioner',
    cooler: 'air cooler',
    speaker: 'speaker',
    earphone: 'earphones',
    headphone: 'headphones',

    // Footwear
    juta: 'shoes',
    joota: 'shoes',
    joote: 'shoes',
    jute: 'shoes',
    chappal: 'slippers',
    sandal: 'sandals',
    sandaley: 'sandals',

    // Clothing
    kapda: 'clothes',
    kapde: 'clothes',
    kapdo: 'clothes',
    shirt: 'shirt',
    kameez: 'shirt',
    kameej: 'shirt',
    kamiz: 'shirt',
    tshirt: 't-shirt',
    tee: 't-shirt',
    kurta: 'kurta',
    kurti: 'kurti',
    pant: 'pants',
    pajama: 'pajama',
    jeans: 'jeans',
    lehenga: 'lehenga',
    saree: 'saree',
    saari: 'saree',
  };

  private translateHinglish(text: string): string {
    const words = text.split(/\s+/);
    const mapped = words.map((word) => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      if (this.hinglishDict[cleanWord]) {
        const mappedWord = this.hinglishDict[cleanWord];
        if (word[0] === word[0].toUpperCase()) {
          return mappedWord.charAt(0).toUpperCase() + mappedWord.slice(1);
        }
        return mappedWord;
      }
      return word;
    });
    return mapped.join(' ');
  }

  // 🎯 Main Public Method
  async translateToEnglish(
    text: string,
    sourceLanguage?: string,
  ): Promise<string> {
    if (!text?.trim()) return text;

    // Apply Hinglish/Romanized local dictionary translation first
    const hinglishTranslated = this.translateHinglish(text);

    // ⚡ Skip very short queries
    if (hinglishTranslated.length < 3) return hinglishTranslated;

    const detectedLang = this.normalizeLang(
      sourceLanguage || this.detectLanguage(hinglishTranslated),
    );

    // ⚡ Skip if already English
    if (detectedLang === 'en') return hinglishTranslated;

    return await this.callGoogleTranslateAPI(hinglishTranslated, detectedLang, 'en');
  }
}
