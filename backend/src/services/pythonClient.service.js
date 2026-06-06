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

async function postSalesReturnValidate(
  salesBuffer,
  salesName,
  salesMime,
  returnBuffer,
  returnName,
  returnMime,
  options = {}
) {
  const form = new FormData();
  form.append('sales_file', salesBuffer, {
    filename: salesName || 'sales-audit.xlsx',
    contentType: salesMime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('sales_return_file', returnBuffer, {
    filename: returnName || 'sales-return-audit.xlsx',
    contentType: returnMime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

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

async function postSalesReturnExportExceptions(records, options = {}) {
  return postExportInvalidRows('/api/process/sales-return/export-exceptions', records, options);
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

module.exports = {
  postPanValidate,
  postPanExportInvalid,
  postGrossWeightValidate,
  postGrossWeightExportInvalid,
  postSalesValidate,
  postSalesExportInvalid,
  postSalesReturnValidate,
  postSalesReturnExportRateComparison,
  postSalesReturnExportExceptions,
  getRateRules,
  postRateRules,
  getDiamondRateRules,
  postDiamondRateRules,
};
