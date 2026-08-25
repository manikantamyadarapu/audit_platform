/**
 * Client-side Closing Stock Rule Book mapper (mirrors python product_rule_book.py).
 * Used when API/session result lacks productsByCategory, and as a display fallback.
 */

import { CLOSING_STOCK_CATEGORIES } from '../config/closingStockLayout';
import ruleBookRaw from '../config/closingStockProductRuleBook.json';

const SHEET_KEY_ALIASES = {
  Precious: 'Precious and Semi Precious',
};

function normProduct(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function cleanProductList(entries) {
  const cleaned = [];
  const seen = new Set();
  for (const item of entries || []) {
    const name = String(item || '').trim();
    if (!name) continue;
    const key = normProduct(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(name);
  }
  return cleaned;
}

function loadRuleBook() {
  const normalized = {};
  for (const [key, value] of Object.entries(ruleBookRaw || {})) {
    const sheet = SHEET_KEY_ALIASES[key] || key;
    if (normalized[sheet] && key !== sheet) continue;
    normalized[sheet] = value;
  }

  const book = {};
  for (const category of CLOSING_STOCK_CATEGORIES) {
    const entries = normalized[category];
    if (Array.isArray(entries)) {
      book[category] = cleanProductList(entries);
    } else if (entries && typeof entries === 'object') {
      const subcats = {};
      for (const [subName, products] of Object.entries(entries)) {
        const label = String(subName || '').trim();
        if (!label) continue;
        subcats[label] = cleanProductList(products);
      }
      book[category] = subcats;
    } else {
      book[category] = [];
    }
  }
  return book;
}

function buildLocationIndex(book) {
  const index = {};
  for (const category of CLOSING_STOCK_CATEGORIES) {
    const section = book[category];
    if (Array.isArray(section)) {
      for (const product of section) {
        const key = normProduct(product);
        if (key && !index[key]) index[key] = { category, subcategory: null };
      }
    } else if (section && typeof section === 'object') {
      for (const [subcategory, products] of Object.entries(section)) {
        for (const product of products) {
          const key = normProduct(product);
          if (key && !index[key]) index[key] = { category, subcategory };
        }
      }
    }
  }
  return index;
}

function resolveLocation(product, index) {
  const key = normProduct(product);
  if (!key) return null;
  if (index[key]) return index[key];

  const tokens = key.split(' ').filter(Boolean);
  let best = null;
  let bestLen = 0;
  for (const [ruleKey, loc] of Object.entries(index)) {
    const ruleTokens = ruleKey.split(' ').filter(Boolean);
    const n = ruleTokens.length;
    if (!n || n > tokens.length) continue;
    const suffix = tokens.slice(-n);
    if (suffix.every((t, i) => t === ruleTokens[i]) && n > bestLen) {
      best = loc;
      bestLen = n;
    }
  }
  return best;
}

function subcategoryTotalLabel(category, subcategory) {
  if (category === 'Precious and Semi Precious') {
    return `TOTAL - ${String(subcategory || '').trim().toUpperCase()}`;
  }
  return 'TOTAL';
}

function matchedInOrder(ruleProducts, matchedDisplayByNorm) {
  const ordered = [];
  const claimed = new Set();
  for (const ruleName of ruleProducts) {
    const ruleKey = normProduct(ruleName);
    if (matchedDisplayByNorm[ruleKey]) {
      ordered.push(matchedDisplayByNorm[ruleKey]);
      claimed.add(ruleKey);
      continue;
    }
    const ruleTokens = ruleKey.split(' ').filter(Boolean);
    for (const [matchedKey, matchedName] of Object.entries(matchedDisplayByNorm)) {
      if (claimed.has(matchedKey)) continue;
      const matchedTokens = matchedKey.split(' ').filter(Boolean);
      const n = ruleTokens.length;
      if (!n || n > matchedTokens.length) continue;
      const suffix = matchedTokens.slice(-n);
      if (suffix.every((t, i) => t === ruleTokens[i])) {
        ordered.push(matchedName);
        claimed.add(matchedKey);
        break;
      }
    }
  }
  return ordered;
}

function buildLayout(category, ruleSection, matchedDisplayByNorm) {
  const layout = [];
  const flatProducts = [];

  if (ruleSection && typeof ruleSection === 'object' && !Array.isArray(ruleSection)) {
    for (const [subcategory, ruleProducts] of Object.entries(ruleSection)) {
      const matched = matchedInOrder(ruleProducts, matchedDisplayByNorm);
      if (!matched.length) continue;
      layout.push({ kind: 'subcategory', label: subcategory, subcategory });
      for (const product of matched) {
        layout.push({ kind: 'product', label: product, subcategory });
        flatProducts.push(product);
      }
      layout.push({
        kind: 'subcategory_total',
        label: subcategoryTotalLabel(category, subcategory),
        subcategory,
      });
    }
  } else if (Array.isArray(ruleSection)) {
    for (const product of matchedInOrder(ruleSection, matchedDisplayByNorm)) {
      layout.push({ kind: 'product', label: product, subcategory: null });
      flatProducts.push(product);
    }
  }

  if (flatProducts.length || layout.length) {
    layout.push({ kind: 'grand_total', label: 'GRAND TOTAL', subcategory: null });
  }
  return { layout, flatProducts };
}

/**
 * Map Sales + Purchases pivots through the Rule Book.
 * @param {{ salesPivot?: object[], purchasesPivot?: object[] }} pivots
 */
export function mapPivotsToClosingStockCategories({
  salesPivot = [],
  purchasesPivot = [],
} = {}) {
  const book = loadRuleBook();
  const index = buildLocationIndex(book);
  const productsByCategory = Object.fromEntries(CLOSING_STOCK_CATEGORIES.map((c) => [c, []]));
  const layoutByCategory = Object.fromEntries(CLOSING_STOCK_CATEGORIES.map((c) => [c, []]));
  const matchedDisplay = Object.fromEntries(CLOSING_STOCK_CATEGORIES.map((c) => [c, {}]));
  const unmappedProducts = [];
  const unmappedProductDetails = [];
  const unmappedSeen = new Set();

  function route(rows, source) {
    for (const row of rows || []) {
      const productName = String(row?.product || '').trim();
      if (!productName) continue;
      const loc = resolveLocation(productName, index);
      if (!loc) {
        const key = normProduct(productName);
        if (!unmappedSeen.has(key)) {
          unmappedSeen.add(key);
          unmappedProducts.push(productName);
          unmappedProductDetails.push({ product: productName, source });
          // eslint-disable-next-line no-console
          console.warn(`Unmapped product: ${productName} Source: ${source}`);
        }
        continue;
      }
      const key = normProduct(productName);
      if (!matchedDisplay[loc.category][key]) {
        matchedDisplay[loc.category][key] = productName;
      }
    }
  }

  route(salesPivot, 'Sales');
  route(purchasesPivot, 'Purchases');

  for (const category of CLOSING_STOCK_CATEGORIES) {
    const { layout, flatProducts } = buildLayout(
      category,
      book[category],
      matchedDisplay[category]
    );
    layoutByCategory[category] = layout;
    productsByCategory[category] = flatProducts;
  }

  return {
    productsByCategory,
    layoutByCategory,
    unmappedProducts,
    unmappedProductDetails,
    categories: [...CLOSING_STOCK_CATEGORIES],
  };
}

/** @param {object|null|undefined} result */
export function ensureClosingStockMapping(result) {
  if (!result || typeof result !== 'object') return result;
  const salesPivot = Array.isArray(result.salesPivot) ? result.salesPivot : [];
  const purchasesPivot = Array.isArray(result.purchasesPivot) ? result.purchasesPivot : [];
  const existing = result.productsByCategory;
  const mappedCount = CLOSING_STOCK_CATEGORIES.reduce((total, category) => {
    const rows = existing?.[category];
    return total + (Array.isArray(rows) ? rows.length : 0);
  }, 0);

  if (mappedCount > 0 && result.layoutByCategory) {
    return result;
  }
  if (!salesPivot.length && !purchasesPivot.length) {
    return result;
  }

  const mapped = mapPivotsToClosingStockCategories({ salesPivot, purchasesPivot });
  return {
    ...result,
    productsByCategory: mapped.productsByCategory,
    layoutByCategory: mapped.layoutByCategory,
    unmappedProducts: mapped.unmappedProducts,
    unmappedProductDetails: mapped.unmappedProductDetails,
    closingStockCategories: mapped.categories,
    summary: {
      ...(result.summary || {}),
      mappedProductCount: CLOSING_STOCK_CATEGORIES.reduce(
        (total, category) => total + (mapped.productsByCategory[category]?.length || 0),
        0
      ),
      unmappedProductCount: mapped.unmappedProducts.length,
    },
  };
}
