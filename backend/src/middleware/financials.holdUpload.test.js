const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const FormData = require('form-data');
const axios = require('axios');
const { financialsHoldFiles, financialsPivotFiles, handleMulterError } = require('./upload.middleware');

function fakeXlsx(name) {
  return Buffer.from(`PK\x03\x04${name}`);
}

async function postWithFields(middleware, fieldNames) {
  const app = express();
  app.post('/hold', (req, res) => {
    middleware(req, res, (err) =>
      handleMulterError(err, req, res, () => {
        res.json({
          ok: true,
          fields: Object.keys(req.files || {}).sort(),
        });
      })
    );
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  try {
    const form = new FormData();
    for (const name of fieldNames) {
      form.append(name, fakeXlsx(name), {
        filename: `${name}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    }
    const response = await axios.post(`http://127.0.0.1:${port}/hold`, form, {
      headers: form.getHeaders(),
      validateStatus: () => true,
    });
    return response;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const SIX = [
  'salesFile',
  'purchasesFile',
  'openingQtyFile',
  'previousYearFile',
  'mrFile',
  'dcFile',
];

test('legacy six-file multer rejects Basheerbagh Sales Return extras', async () => {
  const response = await postWithFields(financialsPivotFiles, [...SIX, 'salesReturnFile']);
  assert.equal(response.status, 400);
  // Multer may report unexpected field name or the six-file count limit.
  assert.match(String(response.data?.error || ''), /Unexpected field|Too many files/i);
});

test('hold multer accepts Basheerbagh six files plus Sales/Purchase Return extras', async () => {
  const response = await postWithFields(financialsHoldFiles, [
    ...SIX,
    'salesReturnFile',
    'purchaseReturnFile',
  ]);
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.fields, [
    'dcFile',
    'mrFile',
    'openingQtyFile',
    'previousYearFile',
    'purchaseReturnFile',
    'purchasesFile',
    'salesFile',
    'salesReturnFile',
  ]);
});

test('hold multer accepts Jubilee Hills ten-file set', async () => {
  const response = await postWithFields(financialsHoldFiles, [
    ...SIX,
    'salesReturnFile',
    'purchaseReturnFile',
    'creditNoteFile',
    'debitNoteFile',
  ]);
  assert.equal(response.status, 200);
  assert.equal(response.data.fields.length, 10);
});
