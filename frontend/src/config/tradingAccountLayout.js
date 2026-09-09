import { buildClosingStockPreviewRows } from './closingStockLayout';

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
 * Qty sign picks the side. Amount is always ABS(Receipts Amt − Issues Amt).
 * @param {object|null|undefined} grandTotal
 * @returns {{ side: 'left'|'right', label: string, qty: number, amt: number }|null}
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
    return { side: 'left', label: FROM_HEAD_OFFICE, qty, amt };
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
