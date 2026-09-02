const assert = require('node:assert/strict');
const test = require('node:test');

const { financialsFileFilter } = require('./upload.middleware');

function runFilter(originalname, mimetype) {
  let outcome;
  financialsFileFilter(
    {},
    { originalname, mimetype },
    (error, accepted) => {
      outcome = { error, accepted };
    }
  );
  return outcome;
}

test('accepts Financials xlsx workbooks', () => {
  const outcome = runFilter(
    'sales.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  assert.equal(outcome.error, null);
  assert.equal(outcome.accepted, true);
});

test('accepts Financials xlsm workbooks', () => {
  const outcome = runFilter(
    'opening-quantity.xlsm',
    'application/vnd.ms-excel.sheet.macroEnabled.12'
  );

  assert.equal(outcome.error, null);
  assert.equal(outcome.accepted, true);
});

test('rejects legacy xls workbooks before openpyxl processing', () => {
  const outcome = runFilter(
    'previous-year.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  assert.equal(outcome.accepted, undefined);
  assert.match(outcome.error.message, /Allowed extensions: \.xlsx, \.xlsm/);
  assert.equal(outcome.error.status, 400);
});
