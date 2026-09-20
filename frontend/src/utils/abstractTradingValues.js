import {
  ABSTRACT_ACCOUNT_ROWS,
  ABSTRACT_MEASURE_GROUPS,
  COLOR_STONE_PRODUCT_ROWS,
  DIAMOND_PRODUCT_ROWS,
} from '../config/abstractLayout';
import {
  TRADING_ACCOUNT_SOURCE_CATEGORY,
  TRADING_METAL_ACCOUNTS,
  grandTotalFromLayout,
  metalTradingLineValues,
  tradingLineValues,
} from '../config/tradingAccountLayout';
import { aggregateMetalTradingTotals } from './metalTradingTotals';

const ISSUE_QTY_KEYS = ['issuesInternalQty', 'issuesBanjaraHillsQty', 'issuesKokapetQty'];
const ISSUE_AMT_KEYS = ['issuesInternalAmt', 'issuesBanjaraHillsAmt', 'issuesKokapetAmt'];

const METAL_BY_TITLE = Object.fromEntries(
  TRADING_METAL_ACCOUNTS.map((account) => [account.title, account])
);

function emptyMeasures() {
  return Object.fromEntries(ABSTRACT_MEASURE_GROUPS.map((group) => [group, { qty: null, amt: null }]));
}

function tradingLine(label, totals, metal, account, side) {
  if (metal) return metalTradingLineValues(label, totals, side, account);
  return tradingLineValues(label, totals, side);
}

function sumKeys(totals, keys) {
  let total = null;
  keys.forEach((key) => {
    const value = totals?.[key];
    if (value == null) return;
    total = (total == null ? 0 : total) + Number(value);
  });
  return total;
}

function consumptionIssues(totals) {
  if (totals?.issuesTotalQty != null || totals?.issuesTotalAmt != null) {
    return { qty: totals.issuesTotalQty ?? null, amt: totals.issuesTotalAmt ?? null };
  }
  return { qty: sumKeys(totals, ISSUE_QTY_KEYS), amt: sumKeys(totals, ISSUE_AMT_KEYS) };
}

function cyGpPct(gpAmt, salesAmt) {
  if (gpAmt == null || salesAmt == null) return null;
  const sales = Number(salesAmt);
  if (sales === 0) return 0;
  return (Number(gpAmt) / sales) * 100;
}

export function abstractMeasuresFromTradingSource(totals, { metal = false, metalAccount = null } = {}) {
  const source = totals || {};
  const opening = tradingLine('To Opening Stock', source, metal, metalAccount, 'left');
  const purchases = tradingLine('To Purchases', source, metal, metalAccount, 'left');
  const sales = tradingLine('By Sales', source, metal, metalAccount, 'right');
  const closing = tradingLine('By Closing stock', source, metal, metalAccount, 'right');
  const gp = tradingLine('To Gross Profit', source, metal, metalAccount, 'left');
  const consumption = consumptionIssues(source);
  const pairs = {
    'Opening Stock': opening,
    Purchases: purchases,
    'Receipts - Jubilee Hills': {
      qty: source.receiptsJubileeHillsQty ?? null,
      amt: source.receiptsJubileeHillsAmt ?? null,
    },
    'Transfer (Receipts)': {
      qty: source.receiptsInternalQty ?? null,
      amt: source.receiptsInternalAmt ?? null,
    },
    'Issues - Internal Stock Transfer': {
      qty: source.issuesInternalQty ?? null,
      amt: source.issuesInternalAmt ?? null,
    },
    'Issues - Jubilee Hills': {
      qty: source.issuesBanjaraHillsQty ?? null,
      amt: source.issuesBanjaraHillsAmt ?? null,
    },
    'Consumption (Issues)': consumption,
    'Making Charges': {
      qty: source.makingChargesQty ?? null,
      amt: source.makingChargesAmt ?? null,
    },
    Sales: sales,
    'Closing Stock': closing,
    'Gross Profit': gp,
    'CY GP %': { qty: null, amt: cyGpPct(gp.amt, sales.amt) },
  };
  return Object.fromEntries(ABSTRACT_MEASURE_GROUPS.map((group) => [group, pairs[group]]));
}

export function sumAbstractMeasures(rows) {
  const summed = emptyMeasures();
  ABSTRACT_MEASURE_GROUPS.forEach((group) => {
    if (group === 'CY GP %') return;
    let qty = null;
    let amt = null;
    rows.forEach((row) => {
      const pair = row?.[group] || {};
      if (pair.qty != null) qty = (qty == null ? 0 : qty) + Number(pair.qty);
      if (pair.amt != null) amt = (amt == null ? 0 : amt) + Number(pair.amt);
    });
    summed[group] = { qty, amt };
  });
  summed['CY GP %'] = {
    qty: null,
    amt: cyGpPct(summed['Gross Profit']?.amt, summed.Sales?.amt),
  };
  return summed;
}

function subcategoryTotal(layoutRows, subcategory) {
  const rows = Array.isArray(layoutRows) ? layoutRows : [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (String(row?.kind || '') !== 'subcategory_total') continue;
    if (String(row?.subcategory || '').trim() === subcategory) return row;
  }
  return {};
}

export function buildAbstractRowMeasures({
  layoutByCategory = {},
  salesPivot = [],
  purchasesPivot = [],
  openingPivot = [],
  mrPivots = {},
  dcPivots = {},
} = {}) {
  const metalTotals = aggregateMetalTradingTotals({
    salesPivot,
    purchasesPivot,
    openingPivot,
    mrPivots,
    dcPivots,
  });
  const byLabel = {};
  const section1 = [];
  ABSTRACT_ACCOUNT_ROWS.forEach(({ label, tradingTitle, metal }) => {
    let measures;
    if (metal) {
      measures = abstractMeasuresFromTradingSource(metalTotals[tradingTitle] || {}, {
        metal: true,
        metalAccount: METAL_BY_TITLE[tradingTitle],
      });
    } else {
      const category = TRADING_ACCOUNT_SOURCE_CATEGORY[tradingTitle];
      measures = abstractMeasuresFromTradingSource(grandTotalFromLayout(layoutByCategory[category]));
    }
    byLabel[label] = measures;
    section1.push(measures);
  });
  byLabel.TOTAL = sumAbstractMeasures(section1);

  const diamondLayout = layoutByCategory.Diamond;
  const diamondRows = DIAMOND_PRODUCT_ROWS.map((product) => {
    const measures = abstractMeasuresFromTradingSource(subcategoryTotal(diamondLayout, product));
    byLabel[product] = measures;
    return measures;
  });
  byLabel['Total Diamonds'] = sumAbstractMeasures(diamondRows);

  const colorLayout = layoutByCategory['Precious and Semi Precious'];
  const colorRows = COLOR_STONE_PRODUCT_ROWS.map((product) => {
    const measures = abstractMeasuresFromTradingSource(subcategoryTotal(colorLayout, product));
    byLabel[product] = measures;
    return measures;
  });
  byLabel['TOTAL Colour Stones'] = sumAbstractMeasures(colorRows);
  return byLabel;
}
