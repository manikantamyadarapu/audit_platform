import { useMemo } from 'react';
import { CLOSING_STOCK_CATEGORIES } from '../config/closingStockLayout';
import { filterSheetsToBranchActivity } from '../utils/closingStockProductMapping';

function pickOpeningStockReport(result, mappedResult) {
  const fromResult = result?.openingStockReport || result?.summary?.openingStockReport || null;
  const fromMapped =
    mappedResult?.openingStockReport || mappedResult?.summary?.openingStockReport || null;
  if (!fromResult) return fromMapped || {};
  if (!fromMapped) return fromResult;
  const pendingCount = (report) =>
    report.manualMappingRequiredCount ??
    (Array.isArray(report.manualMappingRequired) ? report.manualMappingRequired.length : 0);
  const fallbackCount = (report) =>
    report.fallbackMatchedCount ??
    (Array.isArray(report.fallbackMatched) ? report.fallbackMatched.length : 0);
  if (
    pendingCount(fromResult) !== pendingCount(fromMapped) ||
    fallbackCount(fromResult) !== fallbackCount(fromMapped)
  ) {
    return fromResult;
  }
  return fromMapped;
}

export function useFinancialsBranchView(result, mappedResult) {
  const salesPivot = useMemo(
    () => (Array.isArray(result?.salesPivot) ? result.salesPivot : []),
    [result]
  );
  const purchasesPivot = useMemo(
    () => (Array.isArray(result?.purchasesPivot) ? result.purchasesPivot : []),
    [result]
  );
  const openingPivot = useMemo(
    () => (Array.isArray(result?.openingPivot) ? result.openingPivot : []),
    [result]
  );
  const mrPivots = useMemo(
    () => (result?.mrPivots && typeof result.mrPivots === 'object' ? result.mrPivots : {}),
    [result]
  );
  const dcPivots = useMemo(
    () => (result?.dcPivots && typeof result.dcPivots === 'object' ? result.dcPivots : {}),
    [result]
  );
  const openingStockReport = useMemo(() => {
    const base = pickOpeningStockReport(result, mappedResult);
    const mappedCount =
      mappedResult?.summary?.productsWithOpeningData ??
      base.mappedToClosingStockCount ??
      (Array.isArray(mappedResult?.mappedOpeningProducts)
        ? mappedResult.mappedOpeningProducts.length
        : undefined);
    if (mappedCount == null) return base;
    return { ...base, mappedToClosingStockCount: mappedCount };
  }, [mappedResult, result]);
  const summary = mappedResult?.summary ?? {};
  const sheets = useMemo(() => {
    const products = mappedResult?.productsByCategory;
    const layout = mappedResult?.layoutByCategory || result?.layoutByCategory;
    const productsByCategory =
      products && typeof products === 'object'
        ? products
        : Object.fromEntries(CLOSING_STOCK_CATEGORIES.map((category) => [category, []]));
    const layoutByCategory =
      layout && typeof layout === 'object'
        ? layout
        : Object.fromEntries(CLOSING_STOCK_CATEGORIES.map((category) => [category, []]));
    return filterSheetsToBranchActivity(productsByCategory, layoutByCategory, {
      salesPivot,
      purchasesPivot,
      openingPivot,
      mrPivots,
      dcPivots,
    });
  }, [mappedResult, result, salesPivot, purchasesPivot, openingPivot, mrPivots, dcPivots]);
  const productsByCategory = sheets.productsByCategory;
  const layoutByCategory = sheets.layoutByCategory;
  const unmappedProducts = useMemo(
    () => (Array.isArray(mappedResult?.unmappedProducts) ? mappedResult.unmappedProducts : []),
    [mappedResult]
  );
  const mappedProductCount = useMemo(
    () =>
      CLOSING_STOCK_CATEGORIES.reduce(
        (total, category) =>
          total +
          (Array.isArray(productsByCategory[category]) ? productsByCategory[category].length : 0),
        0
      ),
    [productsByCategory]
  );

  return {
    salesPivot,
    purchasesPivot,
    openingPivot,
    mrPivots,
    dcPivots,
    openingStockReport,
    summary,
    productsByCategory,
    layoutByCategory,
    unmappedProducts,
    mappedProductCount,
  };
}
