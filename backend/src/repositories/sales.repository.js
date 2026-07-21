/**
 * Sales audit persistence — re-exports the product-average repository so
 * `sales.*` consumers only need to require this one repository file.
 */
const salesProductAverageRepository = require('./salesProductAverage.repository');

module.exports = {
  createAuditRunWithProductAverages: salesProductAverageRepository.createAuditRunWithProductAverages,
  findProductAverageRates: salesProductAverageRepository.findProductAverageRates,
  findLatestSalesAuditProductAverages: salesProductAverageRepository.findLatestSalesAuditProductAverages,
  findAllProductAverageRatesForExport: salesProductAverageRepository.findAllProductAverageRatesForExport,
};
