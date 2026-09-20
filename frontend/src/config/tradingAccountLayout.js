import { buildClosingStockPreviewRows } from './closingStockLayout';
import { metalClosingAmt, metalClosingQty, metalGrossProfitAmt, fromHeadOfficeQty, toHeadOfficeAmt, toHeadOfficeQty } from '../utils/metalTradingTotals';

export const TRADING_SHEET_NAME = 'Trading';

export const TRADING_ACCOUNT_SOURCE_CATEGORY = Object.freeze({
  'DIAMONDS ACCOUNT': 'Diamond',
  'EMERALDS ACCOUNT': 'Emerald',
  'RUBIES ACCOUNT': 'Rubie',
  'PEARLS ACCOUNT': 'Pearls',
  'COLOR STONES ACCOUNT': 'Precious and Semi Precious',
});

export const FROM_HEAD_OFFICE = 'To Transfer from Head Office';
export const TO_HEAD_OFFICE = 'By Transfer to Head Office';

const QTY_EPS = 1e-12;

function coerceMeasure(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Qty sign picks the side. From HO amount stays blank.
 * To HO Amount is ABS(Receipts Amt − Issues Amt).
 */
export function headOfficeTransfer(grandTotal) {
  const qty =
    (Number(grandTotal?.receiptsJubileeHillsQty) || 0) -
    (Number(grandTotal?.issuesBanjaraHillsQty) || 0);
  if (!Number.isFinite(qty) || Math.abs(qty) <= QTY_EPS) return null;

  const receiptsAmt = coerceMeasure(grandTotal?.receiptsJubileeHillsAmt) ?? 0;
  const issuesAmt = coerceMeasure(grandTotal?.issuesBanjaraHillsAmt) ?? 0;
  const amt = Math.abs(receiptsAmt - issuesAmt);

  if (qty > 0) {
    return { side: 'left', label: FROM_HEAD_OFFICE, qty, amt: null };
  }
  return {
    side: 'right',
    label: TO_HEAD_OFFICE,
    qty: Math.abs(qty),
    amt,
  };
}
const LINE_MEASURES = Object.freeze({
  'To Opening Stock': ['openingQty', 'openingAmt'],
  'To Purchases': ['purchasesQty', 'purchasesAmt'],
  'By Sales': ['salesQty', 'salesAmt'],
  'By Closing stock': ['closingStockQty', 'closingStockAmt'],
});

/**
 * @param {Array<{ kind?: string, label?: string }>|null|undefined} layoutRows
 */
export function grandTotalFromLayout(layoutRows) {
  const sourceRows = Array.isArray(layoutRows) ? layoutRows : [];
  const previewRows = sourceRows.length ? buildClosingStockPreviewRows(sourceRows, []) : [];
  const matchTotal = (row) =>
    row &&
    (String(row.kind || '') === 'grand_total' ||
      /^grand total$/i.test(String(row.label || '').trim()));

  for (let i = previewRows.length - 1; i >= 0; i -= 1) {
    if (matchTotal(previewRows[i])) return previewRows[i];
  }
  for (let i = sourceRows.length - 1; i >= 0; i -= 1) {
    if (matchTotal(sourceRows[i])) return sourceRows[i];
  }
  return null;
}

export function tradingComputed(grandTotal) {
  const opening = tradingSourceValues('To Opening Stock', grandTotal);
  const purchases = tradingSourceValues('To Purchases', grandTotal);
  const sales = tradingSourceValues('By Sales', grandTotal);
  const closing = tradingSourceValues('By Closing stock', grandTotal);
  const transfer = headOfficeTransfer(grandTotal);
  const fromHo = transfer?.side === 'left' ? transfer : { qty: 0, amt: 0 };
  const toHo = transfer?.side === 'right' ? transfer : { qty: 0, amt: 0 };
  const z = (value) => (value == null ? 0 : value);
  const rightQty = z(sales.qty) + z(toHo.qty) + z(closing.qty);
  const rightAmt = z(sales.amt) + z(toHo.amt) + z(closing.amt);
  const grossProfitAmt =
    rightAmt - (z(opening.amt) + z(purchases.amt) + z(fromHo.amt));
  return {
    grossProfitAmt,
    leftQty: z(opening.qty) + z(purchases.qty) + z(fromHo.qty),
    leftAmt: z(opening.amt) + z(purchases.amt) + z(fromHo.amt) + grossProfitAmt,
    rightQty,
    rightAmt,
  };
}

function tradingSourceValues(label, grandTotal) {
  const transfer = headOfficeTransfer(grandTotal);
  if (transfer && label === transfer.label) {
    return { qty: transfer.qty, amt: transfer.amt };
  }
  const keys = LINE_MEASURES[label];
  if (!keys || !grandTotal) return { qty: null, amt: null };
  const [qtyKey, amtKey] = keys;
  return {
    qty: coerceMeasure(grandTotal[qtyKey]),
    amt: coerceMeasure(grandTotal[amtKey]),
  };
}

/**
 * @param {string} label
 * @param {object|null|undefined} grandTotal
 * @param {'left'|'right'} [side]
 * @returns {{ qty: number|null, amt: number|null }}
 */
export function tradingLineValues(label, grandTotal, side = 'left') {
  const computed = tradingComputed(grandTotal);
  if (label === 'To Gross Profit') {
    return { qty: null, amt: computed.grossProfitAmt };
  }
  if (label === 'Total') {
    if (side === 'right') {
      return { qty: computed.rightQty, amt: computed.rightAmt };
    }
    return { qty: computed.leftQty, amt: computed.leftAmt };
  }
  return tradingSourceValues(label, grandTotal);
}

/**
 * Gold/Silver: Opening, Purchases, Sales, Closing, Difference, HO qty, GP amt.
 * HO amounts, returns, making charges, and GP qty stay blank.
 */
export function metalTradingLineValues(label, totals, side = 'left', account) {
  const sideLabels = side === 'right' ? account?.right : account?.left;
  if (label === 'Total') {
    return metalTradingSideTotal(sideLabels, totals, side, account);
  }
  if (label === 'To Gross Profit') {
    const rightAmt = metalTradingSideTotal(account?.right, totals, 'right', account).amt;
    return { qty: null, amt: metalGrossProfitAmt(totals, rightAmt) };
  }
  if (label === FROM_HEAD_OFFICE) {
    return { qty: fromHeadOfficeQty(totals), amt: null };
  }
  if (label === TO_HEAD_OFFICE) {
    return { qty: toHeadOfficeQty(totals), amt: toHeadOfficeAmt(totals) };
  }
  const transfer = headOfficeTransfer(totals);
  if (transfer && label === transfer.label) {
    return { qty: transfer.qty, amt: transfer.amt };
  }
  if (label === 'Difference') {
    if (!totals) return { qty: null, amt: null };
    if (side === 'right') {
      return {
        qty: coerceMeasure(totals.netSalesQty),
        amt: coerceMeasure(totals.netSalesAmt),
      };
    }
    return {
      qty: coerceMeasure(totals.netPurchasesQty),
      amt: coerceMeasure(totals.netPurchasesAmt),
    };
  }
  if (label === 'By Closing stock') {
    return {
      qty: metalClosingQty(totals),
      amt: metalClosingAmt(totals),
    };
  }
  const keys = LINE_MEASURES[label];
  if (!keys || !totals) return { qty: null, amt: null };
  const [qtyKey, amtKey] = keys;
  return {
    qty: coerceMeasure(totals[qtyKey]),
    amt: coerceMeasure(totals[amtKey]),
  };
}

const METAL_TOTAL_SKIP = new Set(['Total', 'Difference', '']);

export function metalTradingSideTotal(labels, totals, side, account) {
  let qty = null;
  let amt = null;
  (Array.isArray(labels) ? labels : []).forEach((label) => {
    if (!label || METAL_TOTAL_SKIP.has(label)) return;
    const values = metalTradingLineValues(label, totals, side, account);
    const sign = String(label).startsWith('Less:') ? -1 : 1;
    if (values.qty != null) qty = (qty == null ? 0 : qty) + sign * values.qty;
    if (values.amt != null) amt = (amt == null ? 0 : amt) + sign * values.amt;
  });
  return { qty, amt };
}

export const TRADING_METAL_ACCOUNTS = Object.freeze([
  {
    title: 'GOLD ACCOUNT - 24K',
    qtyHeader: 'Qty (Grms)',
    left: [
      'To Opening Stock',
      'To Purchases',
      'Less: Purchase Returns',
      'Difference',
      'To Gross Profit',
      'Total',
    ],
    right: [
      'By Sales',
      'Less: Sales Returns',
      'Difference',
      'By Transfer to Head Office',
      'By Closing stock',
      'Total',
    ],
  },
  {
    title: 'GOLD ORNAMENTS ACCOUNT - 22K',
    qtyHeader: 'Qty (Grms)',
    left: [
      'To Opening Stock',
      'To Purchases',
      'Less: Purchase Returns',
      'Difference',
      'To Transfer from Head Office',
      'To Making Charges',
      'To Gross Profit',
      'Total',
    ],
    right: [
      'By Sales',
      'Less: Sales Returns',
      'Difference',
      'By Closing stock',
      'Total',
    ],
  },
  {
    title: 'GOLD ORNAMENTS ACCOUNT - 18K',
    qtyHeader: 'Qty (Grms)',
    left: [
      'To Opening Stock',
      'To Purchases',
      'Less: Returns',
      'Difference',
      'To Transfer from Head Office',
      'To Making Charges',
      'To Gross Profit',
      'Total',
    ],
    right: [
      'By Sales',
      'Less: Returns',
      'Difference',
      'By Closing stock',
      'Total',
    ],
  },
  {
    title: 'GOLD ORNAMENTS ACCOUNT - 14K',
    qtyHeader: 'Qty (Grms)',
    left: [
      'To Opening Stock',
      'To Purchases',
      'Less: Purchase Returns',
      'Difference',
      'To Transfer from Head Office',
      'To Gross Profit',
      'Total',
    ],
    right: [
      'By Sales',
      'Less: Sales Returns',
      'Difference',
      'By Closing stock',
      'Total',
    ],
  },
  {
    title: 'SILVER ACCOUNT',
    qtyHeader: 'Qty (Grms)',
    left: [
      'To Opening Stock',
      'To Purchases',
      'Less: Returns',
      'Difference',
      'To Transfer from Head Office',
      'To Gross Profit',
      'Total',
    ],
    right: [
      'By Sales',
      'Less: Sales Returns',
      'Difference',
      'By Closing stock',
      'Total',
    ],
  },
]);

export const TRADING_ACCOUNTS = Object.freeze([
  {
    title: 'DIAMONDS ACCOUNT',
    qtyHeader: 'Qty (Cts)',
    left: ['To Opening Stock', 'To Purchases', 'To Gross Profit', 'Total'],
    right: ['By Sales', 'By Closing stock', 'Total'],
  },
  {
    title: 'EMERALDS ACCOUNT',
    qtyHeader: 'Qty (Cts)',
    left: ['To Opening Stock', 'To Purchases', 'To Gross Profit', 'Total'],
    right: ['By Sales', 'By Closing stock', 'Total'],
  },
  {
    title: 'RUBIES ACCOUNT',
    qtyHeader: 'Qty (Cts)',
    left: ['To Opening Stock', 'To Purchases', 'To Gross Profit', 'Total'],
    right: ['By Sales', 'By Closing stock', 'Total'],
  },
  {
    title: 'PEARLS ACCOUNT',
    qtyHeader: 'Qty (Grms)',
    left: ['To Opening Stock', 'To Purchases', 'To Gross Profit', 'Total'],
    right: ['By Sales', 'By Closing stock', 'Total'],
  },
  {
    title: 'COLOR STONES ACCOUNT',
    qtyHeader: 'Qty (Cts)',
    left: ['To Opening Stock', 'To Purchases', 'To Gross Profit', 'Total'],
    right: ['By Sales', 'By Closing stock', 'Total'],
  },
]);

/**
 * Align left/right bodies so both Totals sit on the same row.
 * Transfer particulars appear only when Receipts Jubilee Hills − Issues Banjara Hills is non-zero.
 * @param {{ left: string[], right: string[] }} account
 * @param {object|null|undefined} grandTotal
 */
export function tradingAccountRows(account, grandTotal) {
  const left = ['To Opening Stock', 'To Purchases'];
  const right = ['By Sales'];
  const transfer = headOfficeTransfer(grandTotal);
  if (transfer?.side === 'left') left.push(FROM_HEAD_OFFICE);
  left.push('To Gross Profit', 'Total');
  if (transfer?.side === 'right') right.push(TO_HEAD_OFFICE);
  right.push('By Closing stock', 'Total');

  const leftBody = left.slice(0, -1);
  const rightBody = right.slice(0, -1);
  const bodyRows = Math.max(leftBody.length, rightBody.length);
  const rows = [];
  for (let i = 0; i < bodyRows; i += 1) {
    rows.push({
      left: leftBody[i] || '',
      right: rightBody[i] || '',
      isTotal: false,
      amountOnly: leftBody[i] === 'To Gross Profit',
    });
  }
  rows.push({ left: 'Total', right: 'Total', isTotal: true, amountOnly: false });
  return rows;
}

/**
 * Fixed Gold/Silver T-account rows. No values and no Head Office hiding.
 * @param {{ left: string[], right: string[] }} account
 */
export function metalTradingAccountRows(account) {
  const leftBody = account.left.slice(0, -1);
  const rightBody = account.right.slice(0, -1);
  const bodyRows = Math.max(leftBody.length, rightBody.length);
  const rows = [];
  for (let i = 0; i < bodyRows; i += 1) {
    rows.push({
      left: leftBody[i] || '',
      right: rightBody[i] || '',
      isTotal: false,
      amountOnly: leftBody[i] === 'To Gross Profit',
    });
  }
  rows.push({ left: 'Total', right: 'Total', isTotal: true, amountOnly: false });
  return rows;
}
