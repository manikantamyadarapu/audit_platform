const axios = require('axios');
const FormData = require('form-data');
const { PYTHON_SERVICE_URL, PYTHON_SERVICE_TIMEOUT_MS } = require('../config');

const client = axios.create({
  baseURL: PYTHON_SERVICE_URL,
  timeout: PYTHON_SERVICE_TIMEOUT_MS,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
  headers: {
    'User-Agent': 'audit-platform-node-backend/1.0',
  },
});

/**
 * @param {Buffer} fileBuffer
 * @param {string} originalname
 * @param {string} [mimetype]
 */
function mapAxiosError(err) {
  if (!err.response) {
    const hint =
      err.code === 'ECONNREFUSED'
        ? ' Is FastAPI running (uvicorn on PYTHON_SERVICE_URL)?'
        : /timeout/i.test(err.message || '')
          ? ' Request exceeded PYTHON_SERVICE_TIMEOUT_MS — try raising it or freeing the Python worker (avoid parallel huge uploads while one is running).'
          : '';
    const e = new Error((err.message || 'Python service unreachable') + hint);
    e.status = 502;
    return e;
  }
  const { status, data } = err.response;
  let detail = `Python service returned ${status}`;
  if (data && typeof data === 'object' && data.detail) detail = String(data.detail);
  else if (typeof data === 'string') detail = data;
  const e = new Error(detail);
  if (status === 422) e.status = 422;
  else if (status === 400) e.status = 400;
  else if (status >= 500) e.status = 502;
  else e.status = status;
  if (data && typeof data === 'object') e.apiBody = data;
  return e;
}

/**
 * @param {string} pythonPath e.g. '/api/process/pan'
 * @param {Buffer} fileBuffer
 * @param {string} originalname
 * @param {string} [mimetype]
 * @param {{ requestId?: string }} [options]
 */
async function postExcelProcess(pythonPath, fileBuffer, originalname, mimetype, options = {}) {
  const form = new FormData();
  form.append('file', fileBuffer, {
    filename: originalname || 'upload.xlsx',
    contentType: mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const headers = { ...form.getHeaders() };
  if (options.requestId) {
    headers['x-request-id'] = options.requestId;
  }

  try {
    const { data } = await client.post(pythonPath, form, {
      headers,
    });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

/**
 * @param {Buffer} fileBuffer
 * @param {string} originalname
 * @param {string} [mimetype]
 * @param {{ requestId?: string }} [options]
 */
async function postPanValidate(fileBuffer, originalname, mimetype, options = {}) {
  return postExcelProcess('/api/process/pan', fileBuffer, originalname, mimetype, options);
}

async function postGrossWeightValidate(fileBuffer, originalname, mimetype, options = {}) {
  return postExcelProcess('/api/process/gross-weight', fileBuffer, originalname, mimetype, options);
}

async function postSalesValidate(fileBuffer, originalname, mimetype, options = {}) {
  return postExcelProcess('/api/process/sales', fileBuffer, originalname, mimetype, options);
}

async function postPurchaseValidate(fileBuffer, originalname, mimetype, options = {}) {
  return postExcelProcess('/api/process/purchase', fileBuffer, originalname, mimetype, options);
}

async function postPurchaseExportInvalid(records, options = {}) {
  return postExportInvalidRows('/api/process/purchase/export-invalid', records, options);
}

async function postCashLedgerValidate(fileBuffer, originalname, mimetype, options = {}) {
  return postExcelProcess('/api/process/cash-ledger', fileBuffer, originalname, mimetype, options);
}

async function postSalesReturnValidate(
  returnBuffer,
  returnName,
  returnMime,
  salesAverages,
  options = {}
) {
  const form = new FormData();
  form.append('sales_return_file', returnBuffer, {
    filename: returnName || 'sales-return-audit.xlsx',
    contentType: returnMime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('sales_averages', JSON.stringify(salesAverages ?? []));

  const headers = { ...form.getHeaders() };
  if (options.requestId) {
    headers['x-request-id'] = options.requestId;
  }

  try {
    const { data } = await client.post('/api/process/sales-return/validate', form, { headers });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

async function postSalesReturnExportRateComparison(records, options = {}) {
  return postExportInvalidRows('/api/process/sales-return/export-rate-comparison', records, options);
}

async function postSalesReturnExportExceptions(payload, options = {}) {
  try {
    const headers = {};
    if (options.requestId) {
      headers['x-request-id'] = options.requestId;
    }

    const response = await client.post('/api/process/sales-return/export-exceptions', payload, {
      responseType: 'arraybuffer',
      validateStatus: () => true,
      headers,
    });

    const contentType = response.headers['content-type'];
    const contentDisposition = response.headers['content-disposition'];

    if (response.status >= 400) {
      let detail = `Python service returned ${response.status}`;
      try {
        const json = JSON.parse(Buffer.from(response.data).toString('utf8'));
        if (json && json.detail) detail = json.detail;
      } catch {
        // ignore
      }
      const err = new Error(detail);
      if (response.status === 422) err.status = 422;
      else if (response.status === 400) err.status = 400;
      else if (response.status >= 500) err.status = 502;
      else err.status = response.status;
      throw err;
    }

    return {
      buffer: Buffer.from(response.data),
      contentDisposition,
      contentType,
    };
  } catch (err) {
    throw mapAxiosError(err);
  }
}

async function postPurchaseReturnValidate(
  returnBuffer,
  returnName,
  returnMime,
  purchaseAverages,
  options = {}
) {
  const form = new FormData();
  form.append('purchase_return_file', returnBuffer, {
    filename: returnName || 'purchase-return-audit.xlsx',
    contentType: returnMime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('purchase_averages', JSON.stringify(purchaseAverages ?? []));

  const headers = { ...form.getHeaders() };
  if (options.requestId) {
    headers['x-request-id'] = options.requestId;
  }

  try {
    const { data } = await client.post('/api/process/purchase-return/validate', form, { headers });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

async function postPurchaseReturnExportRateComparison(records, options = {}) {
  return postExportInvalidRows(
    '/api/process/purchase-return/export-rate-comparison',
    records,
    options
  );
}

async function postPurchaseReturnExportExceptions(payload, options = {}) {
  try {
    const headers = {};
    if (options.requestId) {
      headers['x-request-id'] = options.requestId;
    }

    const response = await client.post('/api/process/purchase-return/export-exceptions', payload, {
      responseType: 'arraybuffer',
      validateStatus: () => true,
      headers,
    });

    const contentType = response.headers['content-type'];
    const contentDisposition = response.headers['content-disposition'];

    if (response.status >= 400) {
      let detail = `Python service returned ${response.status}`;
      try {
        const json = JSON.parse(Buffer.from(response.data).toString('utf8'));
        if (json && json.detail) detail = json.detail;
      } catch {
        // ignore
      }
      const err = new Error(detail);
      if (response.status === 422) err.status = 422;
      else if (response.status === 400) err.status = 400;
      else if (response.status >= 500) err.status = 502;
      else err.status = response.status;
      throw err;
    }

    return {
      buffer: Buffer.from(response.data),
      contentDisposition,
      contentType,
    };
  } catch (err) {
    if (err.status) throw err;
    throw mapAxiosError(err);
  }
}

/**
 * @param {Array<Record<string, unknown>>} records
 * @returns {Promise<{ buffer: Buffer, contentDisposition: string | undefined, contentType: string | undefined }>}
 */
/**
 * @param {Array<Record<string, unknown>>} records
 * @param {{ requestId?: string }} [options]
 */
/**
 * @param {string} pythonPath e.g. '/api/process/pan/export-invalid'
 * @param {Array<Record<string, unknown>>} records
 * @param {{ requestId?: string }} [options]
 */
async function postExportInvalidRows(pythonPath, records, options = {}) {
  try {
    const headers = {};
    if (options.requestId) {
      headers['x-request-id'] = options.requestId;
    }

    const response = await client.post(pythonPath, { records }, {
      responseType: 'arraybuffer',
      validateStatus: () => true,
      headers,
    });

    const contentType = response.headers['content-type'];
    const contentDisposition = response.headers['content-disposition'];

    if (response.status >= 400) {
      let detail = `Python service returned ${response.status}`;
      try {
        const json = JSON.parse(Buffer.from(response.data).toString('utf8'));
        if (json && json.detail) detail = json.detail;
      } catch {
        // ignore
      }
      const err = new Error(detail);
      err.status = response.status === 422 ? 422 : response.status >= 500 ? 502 : 400;
      throw err;
    }

    return {
      buffer: Buffer.from(response.data),
      contentDisposition,
      contentType,
    };
  } catch (err) {
    if (err.status) throw err;
    throw mapAxiosError(err);
  }
}

async function postPanExportInvalid(records, options = {}) {
  return postExportInvalidRows('/api/process/pan/export-invalid', records, options);
}

async function postGrossWeightExportInvalid(records, options = {}) {
  return postExportInvalidRows('/api/process/gross-weight/export-invalid', records, options);
}

async function postSalesExportInvalid(records, options = {}) {
  return postExportInvalidRows('/api/process/sales/export-invalid', records, options);
}

async function postCashLedgerExportInvalid(records, options = {}) {
  return postExportInvalidRows('/api/process/cash-ledger/export-invalid', records, options);
}

async function postNegativeBankValidate(fileBuffer, originalname, mimetype, options = {}) {
  return postExcelProcess('/api/process/negative-bank', fileBuffer, originalname, mimetype, options);
}

async function postNegativeBankExportInvalid(records, options = {}) {
  return postExportInvalidRows('/api/process/negative-bank/export-invalid', records, options);
}

/**
 * Dual-file Party Wise TDS Summary validate.
 */
async function postPartyWiseTdsValidate(
  purchaseBuffer,
  purchaseName,
  purchaseMime,
  payableBuffer,
  payableName,
  payableMime,
  options = {}
) {
  const form = new FormData();
  form.append('purchase_goods_file', purchaseBuffer, {
    filename: purchaseName || 'tds-purchase-goods.xlsx',
    contentType: purchaseMime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('tds_payable_file', payableBuffer, {
    filename: payableName || 'tds-payable.xlsx',
    contentType: payableMime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const headers = { ...form.getHeaders() };
  if (options.requestId) {
    headers['x-request-id'] = options.requestId;
  }

  try {
    const { data } = await client.post('/api/process/party-wise-tds', form, { headers });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

async function postPartyWiseTdsExport(payload, options = {}) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (options.requestId) {
      headers['x-request-id'] = options.requestId;
    }

    const response = await client.post('/api/process/party-wise-tds/export', payload, {
      responseType: 'arraybuffer',
      validateStatus: () => true,
      headers,
    });

    const contentType = response.headers['content-type'];
    const contentDisposition = response.headers['content-disposition'];

    if (response.status >= 400) {
      let detail = `Python service returned ${response.status}`;
      try {
        const text = Buffer.from(response.data).toString('utf8');
        const parsed = JSON.parse(text);
        if (parsed?.detail) detail = parsed.detail;
      } catch {
        /* ignore */
      }
      const err = new Error(detail);
      err.status = response.status;
      throw err;
    }

    return {
      buffer: Buffer.from(response.data),
      contentType:
        contentType ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      contentDisposition:
        contentDisposition || 'attachment; filename="Party_Wise_TDS_Summary.xlsx"',
    };
  } catch (err) {
    if (err.status) throw err;
    throw mapAxiosError(err);
  }
}

async function postTds01Validate(fileBuffer, originalname, mimetype, options = {}) {
  return postExcelProcess('/api/process/tds-rate-0.1', fileBuffer, originalname, mimetype, options);
}

async function postTds01Export(payload, options = {}) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (options.requestId) {
      headers['x-request-id'] = options.requestId;
    }

    const response = await client.post('/api/process/tds-rate-0.1/export', payload, {
      responseType: 'arraybuffer',
      validateStatus: () => true,
      headers,
    });

    const contentType = response.headers['content-type'];
    const contentDisposition = response.headers['content-disposition'];

    if (response.status >= 400) {
      let detail = `Python service returned ${response.status}`;
      try {
        const text = Buffer.from(response.data).toString('utf8');
        const parsed = JSON.parse(text);
        if (parsed?.detail) detail = parsed.detail;
      } catch {
        /* ignore */
      }
      const err = new Error(detail);
      err.status = response.status;
      throw err;
    }

    return {
      buffer: Buffer.from(response.data),
      contentType:
        contentType ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      contentDisposition:
        contentDisposition || 'attachment; filename="TDS_0_1_Report.xlsx"',
    };
  } catch (err) {
    if (err.status) throw err;
    throw mapAxiosError(err);
  }
}

async function getRateRules(options = {}) {
  const headers = {};
  if (options.requestId) headers['x-request-id'] = options.requestId;
  try {
    const { data } = await client.get('/api/v1/rate-rules', { headers });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

async function postRateRules(body, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (options.requestId) headers['x-request-id'] = options.requestId;
  try {
    const { data } = await client.post('/api/v1/rate-rules', body, { headers });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

async function getDiamondRateRules(options = {}) {
  const headers = {};
  if (options.requestId) headers['x-request-id'] = options.requestId;
  try {
    const { data } = await client.get('/api/v1/diamond-rate-rules', { headers });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

async function postDiamondRateRules(body, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (options.requestId) headers['x-request-id'] = options.requestId;
  try {
    const { data } = await client.post('/api/v1/diamond-rate-rules', body, { headers });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

async function getRateBookDiamonds(options = {}) {
  const headers = {};
  if (options.requestId) headers['x-request-id'] = options.requestId;
  try {
    const { data } = await client.get('/api/v1/rate-book/diamonds', { headers });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

async function saveRateBookDiamonds(body, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (options.requestId) headers['x-request-id'] = options.requestId;
  try {
    const { data } = await client.post('/api/v1/rate-book/diamonds', body, { headers });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

async function getTdsRules(options = {}) {
  const headers = {};
  if (options.requestId) headers['x-request-id'] = options.requestId;
  try {
    const { data } = await client.get('/api/v1/tds-rules', { headers });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

async function postTdsRules(body, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (options.requestId) headers['x-request-id'] = options.requestId;
  try {
    const { data } = await client.post('/api/v1/tds-rules', body, { headers });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

/**
 * Section 44AB Cash & Bank Audit - multiple file upload
 * @param {Array} cashFiles - Array of file objects with buffer, originalname, mimetype
 * @param {Array} bankFiles - Array of file objects with buffer, originalname, mimetype
 * @param {{ requestId?: string }} [options]
 */
async function postSection44ABValidate(cashFiles, bankFiles, options = {}) {
  const form = new FormData();

  // Append cash files
  cashFiles.forEach((file, index) => {
    form.append('cash_files', file.buffer, {
      filename: file.originalname || `cash_${index}.xlsx`,
      contentType: file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  });

  // Append bank files
  bankFiles.forEach((file, index) => {
    form.append('bank_files', file.buffer, {
      filename: file.originalname || `bank_${index}.xlsx`,
      contentType: file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  });

  const headers = { ...form.getHeaders() };
  if (options.requestId) {
    headers['x-request-id'] = options.requestId;
  }

  try {
    const { data } = await client.post('/api/v1/process/section44ab', form, {
      headers,
    });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

/**
 * Financials first audit — Sales and Purchases product pivots.
 * @param {{ buffer: Buffer, originalname?: string, mimetype?: string }} salesFile
 * @param {{ buffer: Buffer, originalname?: string, mimetype?: string }} purchasesFile
 * @param {{ requestId?: string }} [options]
 */
async function postFinancialsPivot(
  salesFile,
  purchasesFile,
  openingQtyFile,
  previousYearFile,
  options = {}
) {
  const form = new FormData();
  form.append('sales_file', salesFile.buffer, {
    filename: salesFile.originalname || 'sales.xlsx',
    contentType:
      salesFile.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('purchases_file', purchasesFile.buffer, {
    filename: purchasesFile.originalname || 'purchases.xlsx',
    contentType:
      purchasesFile.mimetype ||
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('opening_qty_file', openingQtyFile.buffer, {
    filename: openingQtyFile.originalname || 'opening-quantity.xlsx',
    contentType:
      openingQtyFile.mimetype ||
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('previous_year_file', previousYearFile.buffer, {
    filename: previousYearFile.originalname || 'previous-year-closing.xlsx',
    contentType:
      previousYearFile.mimetype ||
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const headers = { ...form.getHeaders() };
  if (options.requestId) {
    headers['x-request-id'] = options.requestId;
  }

  try {
    const { data } = await client.post('/api/process/financials', form, {
      headers,
    });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

/**
 * @param {object} payload
 * @param {{ requestId?: string }} [options]
 * @returns {Promise<{ buffer: Buffer, contentType: string, contentDisposition: string }>}
 */
async function postFinancialsExportPivots(payload, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (options.requestId) headers['x-request-id'] = options.requestId;
  try {
    const response = await client.post('/api/process/financials/export-pivots', payload, {
      headers,
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      let detail = `Python service returned ${response.status}`;
      try {
        const text = Buffer.from(response.data).toString('utf8');
        const parsed = JSON.parse(text);
        if (parsed?.detail) detail = parsed.detail;
      } catch {
        /* ignore */
      }
      const err = new Error(detail);
      err.status = response.status;
      throw err;
    }

    return {
      buffer: Buffer.from(response.data),
      contentType:
        response.headers['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      contentDisposition: response.headers['content-disposition'] || '',
    };
  } catch (err) {
    throw mapAxiosError(err);
  }
}

/**
 * @param {object} payload
 * @param {{ requestId?: string }} [options]
 * @returns {Promise<{ buffer: Buffer, contentType: string, contentDisposition: string }>}
 */
async function postFinancialsExportClosingStock(payload, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (options.requestId) headers['x-request-id'] = options.requestId;
  try {
    const response = await client.post('/api/process/financials/export-closing-stock', payload, {
      headers,
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      let detail = `Python service returned ${response.status}`;
      try {
        const text = Buffer.from(response.data).toString('utf8');
        const parsed = JSON.parse(text);
        if (parsed?.detail) detail = parsed.detail;
      } catch {
        /* ignore */
      }
      const err = new Error(detail);
      err.status = response.status;
      throw err;
    }

    return {
      buffer: Buffer.from(response.data),
      contentType:
        response.headers['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      contentDisposition: response.headers['content-disposition'] || '',
    };
  } catch (err) {
    throw mapAxiosError(err);
  }
}

/**
 * @param {{ requestId?: string }} [options]
 * @returns {Promise<object>}
 */
async function getClosingStockRuleBook(options = {}) {
  const headers = {};
  if (options.requestId) headers['x-request-id'] = options.requestId;
  try {
    const { data } = await client.get('/api/process/financials/closing-stock-rule-book', {
      headers,
    });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

/**
 * @param {object} payload
 * @param {{ requestId?: string }} [options]
 * @returns {Promise<object>}
 */
async function postFinancialsRemapClosingStock(payload, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (options.requestId) headers['x-request-id'] = options.requestId;
  try {
    const { data } = await client.post('/api/process/financials/remap-closing-stock', payload, {
      headers,
    });
    return data;
  } catch (err) {
    throw mapAxiosError(err);
  }
}

module.exports = {
  postPanValidate,
  postPanExportInvalid,
  postGrossWeightValidate,
  postGrossWeightExportInvalid,
  postSalesValidate,
  postSalesExportInvalid,
  postPurchaseValidate,
  postPurchaseExportInvalid,
  postCashLedgerValidate,
  postCashLedgerExportInvalid,
  postNegativeBankValidate,
  postNegativeBankExportInvalid,
  postPartyWiseTdsValidate,
  postPartyWiseTdsExport,
  postTds01Validate,
  postTds01Export,
  postSalesReturnValidate,
  postSalesReturnExportRateComparison,
  postSalesReturnExportExceptions,
  postPurchaseReturnValidate,
  postPurchaseReturnExportRateComparison,
  postPurchaseReturnExportExceptions,
  getRateRules,
  postRateRules,
  getDiamondRateRules,
  postDiamondRateRules,
  getRateBookDiamonds,
  saveRateBookDiamonds,
  getTdsRules,
  postTdsRules,
  postSection44ABValidate,
  postFinancialsPivot,
  postFinancialsExportPivots,
  postFinancialsExportClosingStock,
  getClosingStockRuleBook,
  postFinancialsRemapClosingStock,
};
