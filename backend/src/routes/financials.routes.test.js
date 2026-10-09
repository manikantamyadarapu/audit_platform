const assert = require('node:assert/strict');
const test = require('node:test');

const financialsRoutes = require('./financials.routes');

function routePaths() {
  return financialsRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => {
      const method = Object.keys(layer.route.methods)[0].toUpperCase();
      return `${method} ${layer.route.path}`;
    });
}

test('Financials validate routes are split by branch and stay authenticated', () => {
  const authLayer = financialsRoutes.stack.find((layer) => !layer.route);
  assert.equal(authLayer.handle.name, 'authenticate');

  const paths = routePaths();
  assert.equal(paths.includes('POST /validate'), false);
  assert.equal(paths.includes('POST /jubilee-hills'), false);
  assert.equal(paths.includes('POST /validate/basheerbagh'), true);
  assert.equal(paths.includes('POST /validate/kokapet'), true);
  assert.equal(paths.includes('POST /validate/jubilee-hills'), true);
});

test('Financials download routes are split by branch and stay authenticated', () => {
  const authLayer = financialsRoutes.stack.find((layer) => !layer.route);
  assert.equal(authLayer.handle.name, 'authenticate');

  const paths = routePaths();
  assert.equal(paths.includes('POST /export-pivots'), false);
  assert.equal(paths.includes('POST /export-closing-stock'), false);
  assert.equal(paths.includes('POST /export-pivots/basheerbagh'), true);
  assert.equal(paths.includes('POST /export-pivots/kokapet'), true);
  assert.equal(paths.includes('POST /export-closing-stock/basheerbagh'), true);
  assert.equal(paths.includes('POST /export-closing-stock/kokapet'), true);
  assert.equal(paths.includes('POST /jubilee-hills/template'), true);
});

test('Financials hold routes are registered and stay authenticated', () => {
  const authLayer = financialsRoutes.stack.find((layer) => !layer.route);
  assert.equal(authLayer.handle.name, 'authenticate');

  const paths = routePaths();
  assert.equal(paths.includes('POST /hold/:branch'), true);
  assert.equal(paths.includes('GET /hold/:branch'), true);
  assert.equal(paths.includes('DELETE /hold/:branch'), true);
});

test('Financials hold POST uses dedicated hold multer (all slot fields)', () => {
  const holdPost = financialsRoutes.stack.find(
    (layer) => layer.route && layer.route.path === '/hold/:branch' && layer.route.methods.post
  );
  assert.ok(holdPost);
  const handlerNames = holdPost.route.stack.map((layer) => layer.handle.name);
  assert.equal(handlerNames.includes('holdBranchUpload'), true);
  assert.equal(handlerNames.includes('holdFinancialsBranchFiles'), true);
});
