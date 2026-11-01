const assert = require('node:assert/strict');
const test = require('node:test');
function fakeFile(name) {
  return {
    fieldname: name,
    originalname: `${name}.xlsx`,
    buffer: Buffer.from(name),
    size: name.length,
  };
}

function sixFiles() {
  return {
    salesFile: [fakeFile('salesFile')],
    purchasesFile: [fakeFile('purchasesFile')],
    openingQtyFile: [fakeFile('openingQtyFile')],
    previousYearFile: [fakeFile('previousYearFile')],
    mrFile: [fakeFile('mrFile')],
    dcFile: [fakeFile('dcFile')],
  };
}

function jubileeFiles() {
  return {
    ...sixFiles(),
    salesReturnFile: [fakeFile('salesReturnFile')],
    purchaseReturnFile: [fakeFile('purchaseReturnFile')],
    creditNoteFile: [fakeFile('creditNoteFile')],
    debitNoteFile: [fakeFile('debitNoteFile')],
  };
}

function loadController(stubs) {
  const controllerPath = require.resolve('./financials.controller');
  const heldPath = require.resolve('../services/heldFinancials.service');
  const servicePath = require.resolve('../services/financials.service');
  delete require.cache[controllerPath];
  require.cache[heldPath] = {
    id: heldPath,
    filename: heldPath,
    loaded: true,
    exports: stubs.held,
  };
  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: stubs.financials,
  };
  const controller = require('./financials.controller');
  return () => {
    delete require.cache[controllerPath];
    delete require.cache[heldPath];
    delete require.cache[servicePath];
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    send(buffer) {
      this.body = buffer;
      return this;
    },
  };
  return res;
}

test('six-file process loads held files when the request has no uploads', async () => {
  const calls = [];
  const cleanup = loadController({
    held: {
      async resolveProcessFiles(req, branch) {
        calls.push(['resolve', branch, req.files]);
        return sixFiles();
      },
    },
    financials: {
      async processFinancialsPivot(_req, salesFile) {
        calls.push(['process', salesFile.originalname]);
        return { data: { success: true }, auditRunId: 1 };
      },
      notifyFinancialsPivotFailure() {},
    },
  });
  try {
    const controller = require('./financials.controller');
    const req = { body: { destinationBranch: 'kokapet' }, files: {}, requestId: 'r1', user: { id: 11 } };
    const res = mockRes();
    await controller.processKokapetFinancials(req, res, (err) => {
      throw err;
    });
    assert.equal(res.statusCode, 200);
    assert.equal(calls[0][0], 'resolve');
    assert.equal(calls[0][1], 'kokapet');
    assert.equal(calls[1][0], 'process');
    assert.equal(res.body.success, true);
  } finally {
    cleanup();
  }
});

test('held-file 404 is returned when the branch set is missing', async () => {
  const cleanup = loadController({
    held: {
      async resolveProcessFiles() {
        const err = new Error('No complete held basheerbagh folder for this user. Missing: sales');
        err.status = 404;
        throw err;
      },
    },
    financials: {
      notifyFinancialsPivotFailure() {},
    },
  });
  try {
    const controller = require('./financials.controller');
    const req = { body: { destinationBranch: 'basheerbagh' }, files: {}, requestId: 'r2', user: { id: 11 } };
    const res = mockRes();
    await controller.processBasheerbaghFinancials(req, res, () => {
      throw new Error('should not fall through');
    });
    assert.equal(res.statusCode, 404);
    assert.match(res.body.detail, /Missing: sales/);
  } finally {
    cleanup();
  }
});

test('Jubilee Hills process forwards receiptRateMappings to the Python client payload', async () => {
  const forwarded = [];
  const mappings = [{ product: 'Di. RA 10', sourceProduct: 'Di RA 10' }];
  const cleanup = loadController({
    held: {
      async resolveProcessFiles(req, branch) {
        forwarded.push(['resolve', branch]);
        return jubileeFiles();
      },
    },
    financials: {
      async processJubileeHillsFinancials(_req, files) {
        forwarded.push(files);
        return { data: { success: true }, auditRunId: 9 };
      },
      notifyFinancialsPivotFailure() {},
    },
  });
  try {
    const controller = require('./financials.controller');
    const req = {
      body: { receiptRateMappings: JSON.stringify(mappings), sourceAverageRates: '{}' },
      files: {},
      requestId: 'r3',
      user: { id: 11 },
    };
    const res = mockRes();
    await controller.processJubileeHillsFinancials(req, res, (err) => {
      throw err;
    });
    assert.equal(forwarded[0][1], 'jubilee-hills');
    assert.equal(forwarded[1].receiptRateMappings, JSON.stringify(mappings));
    assert.equal(forwarded[1].sourceAverageRates, '{}');
  } finally {
    cleanup();
  }
});

test('Jubilee Hills empty receiptRateMappings become []', async () => {
  const forwarded = [];
  const cleanup = loadController({
    held: {
      async resolveProcessFiles() {
        return jubileeFiles();
      },
    },
    financials: {
      async processJubileeHillsFinancials(_req, files) {
        forwarded.push(files.receiptRateMappings);
        return { data: { success: true }, auditRunId: 9 };
      },
      notifyFinancialsPivotFailure() {},
    },
  });
  try {
    const controller = require('./financials.controller');
    const req = { body: {}, files: jubileeFiles(), requestId: 'r4', user: { id: 11 } };
    const res = mockRes();
    await controller.processJubileeHillsFinancials(req, res, (err) => {
      throw err;
    });
    assert.equal(forwarded[0], '[]');
  } finally {
    cleanup();
  }
});

test('closing-stock export forwards destinationBranch, rates, and mappings', async () => {
  const payloads = [];
  const cleanup = loadController({
    held: {},
    financials: {
      async exportClosingStockTemplate(req, payload) {
        payloads.push({ branch: req.financialsBranch, payload });
        return {
          buffer: Buffer.from('xlsx'),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          contentDisposition: 'attachment; filename="x.xlsx"',
        };
      },
    },
  });
  try {
    const controller = require('./financials.controller');
    const req = {
      body: {
        salesPivot: [{ product: 'A' }],
        destinationBranch: 'kokapet',
        sourceAverageRates: { jubileeHills: [{ product: 'A', averageRateAmt: 2 }] },
        receiptRateMappings: [{ product: 'A', sourceProduct: 'A1' }],
      },
      requestId: 'r5',
    };
    const res = mockRes();
    await controller.exportKokapetClosingStock(req, res, (err) => {
      throw err;
    });
    assert.equal(payloads[0].branch, 'kokapet');
    assert.equal(payloads[0].payload.destinationBranch, 'kokapet');
    assert.equal(payloads[0].payload.sourceAverageRates.jubileeHills[0].averageRateAmt, 2);
    assert.equal(payloads[0].payload.receiptRateMappings[0].sourceProduct, 'A1');
  } finally {
    cleanup();
  }
});
