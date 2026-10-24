import { ABSTRACT_ACCOUNT_ROWS } from '../config/abstractLayout';
import { TSHAPE_BRANCH_COLUMNS, TSHAPE_LEFT_ROWS, TSHAPE_RIGHT_ROWS } from '../config/consolidatedTShapeLayout';
import { TRADING_METAL_ACCOUNTS } from '../config/tradingAccountLayout';
import { abstractMeasuresFromTradingSource } from './abstractTradingValues';
import { accountTotals, addNum, eliminate, normalizeBranches } from './consolidatedAbstractValues';

const METAL_BY_TITLE = Object.fromEntries(TRADING_METAL_ACCOUNTS.map((account) => [account.title, account]));

function emptyColumn() {
  const keys = [...TSHAPE_LEFT_ROWS, ...TSHAPE_RIGHT_ROWS];
  return Object.fromEntries(keys.map((key) => [key, null]));
}

function sideTotal(column, labels) {
  let total = null;
  labels.forEach((label) => {
    total = addNum(total, column?.[label]);
  });
  return total;
}

function branchColumn(snapshot) {
  let opening = null;
  let purchases = null;
  let sales = null;
  let closing = null;
  let making = null;
  let gp = null;
  let fromHo = null;
  let toBranches = null;
  ABSTRACT_ACCOUNT_ROWS.forEach(({ tradingTitle, metal }) => {
    const totals = accountTotals(snapshot, tradingTitle, metal);
    const measures = abstractMeasuresFromTradingSource(totals, {
      metal,
      metalAccount: METAL_BY_TITLE[tradingTitle],
    });
    opening = addNum(opening, measures['Opening Stock']?.amt);
    purchases = addNum(purchases, measures.Purchases?.amt);
    sales = addNum(sales, measures.Sales?.amt);
    closing = addNum(closing, measures['Closing Stock']?.amt);
    making = addNum(making, measures['Making Charges']?.amt);
    gp = addNum(gp, measures['Gross Profit']?.amt);
    fromHo = addNum(fromHo, measures['Receipts - Jubilee Hills']?.amt);
    toBranches = addNum(toBranches, measures['Issues - Internal Stock Transfer']?.amt);
    toBranches = addNum(toBranches, measures['Issues - Jubilee Hills']?.amt);
    toBranches = addNum(toBranches, totals.issuesKokapetAmt);
  });
  const column = emptyColumn();
  column['Opening Stock'] = opening;
  column.Purchases = purchases;
  column['Stock transfer from Head Office'] = fromHo;
  column['Making Charges'] = making;
  column['Gross Profit'] = gp;
  column.Sales = sales;
  column['Stock Transfer to Branches'] = toBranches;
  column['Closing Stock'] = closing;
  column.Total = sideTotal(column, TSHAPE_LEFT_ROWS.slice(0, -1));
  return column;
}

function totalColumn(byBranch) {
  const summed = (row) => {
    let total = null;
    TSHAPE_BRANCH_COLUMNS.forEach(({ key }) => {
      total = addNum(total, byBranch[key]?.[row]);
    });
    return total;
  };
  const [fromHo, toBranches] = eliminate(
    summed('Stock transfer from Head Office'),
    summed('Stock Transfer to Branches')
  );
  const opening = summed('Opening Stock');
  const purchases = summed('Purchases');
  const making = summed('Making Charges');
  const sales = summed('Sales');
  const closing = summed('Closing Stock');
  const leftWithoutGp = addNum(addNum(addNum(opening, purchases), fromHo), making);
  const rightWithoutGp = addNum(addNum(sales, toBranches), closing);
  let gp = null;
  if (leftWithoutGp != null || rightWithoutGp != null) {
    gp = (rightWithoutGp || 0) - (leftWithoutGp || 0);
  }
  const column = emptyColumn();
  column['Opening Stock'] = opening;
  column.Purchases = purchases;
  column['Stock transfer from Head Office'] = fromHo;
  column['Making Charges'] = making;
  column['Gross Profit'] = gp;
  column.Sales = sales;
  column['Stock Transfer to Branches'] = toBranches;
  column['Closing Stock'] = closing;
  column.Total = sideTotal(column, TSHAPE_LEFT_ROWS.slice(0, -1));
  return column;
}

export function buildConsolidatedTShapeValues(branches) {
  const snapshots = normalizeBranches(branches);
  const ready = TSHAPE_BRANCH_COLUMNS.every(({ key }) => snapshots[key]);
  const byBranch = {};
  TSHAPE_BRANCH_COLUMNS.forEach(({ key }) => {
    byBranch[key] = ready ? branchColumn(snapshots[key]) : emptyColumn();
  });
  byBranch.total = ready ? totalColumn(byBranch) : emptyColumn();
  return byBranch;
}

export function tshapeSideTotal(column, labels) {
  return sideTotal(column, labels);
}
