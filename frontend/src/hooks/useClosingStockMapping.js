import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchClosingStockRuleBook,
  remapClosingStockFromPivots,
} from '../services/financials.service';
import {
  mapPivotsWithRuleBook,
  mergeRemapIntoResult,
  resultRuleBookFingerprint,
} from '../utils/closingStockProductMapping';

/**
 * Keep Closing Stock UI in sync with the live Rule Book JSON on the Python service.
 *
 * Always rebuilds product/layout from the current JSON + pivots (never trusts a
 * cached productsByCategory list). Persists only when the Rule Book fingerprint changes.
 *
 * @param {object|null|undefined} result
 * @param {(updated: object) => void} [onSynced]
 */
export function useClosingStockMapping(result, onSynced) {
  const [mappedResult, setMappedResult] = useState(result);
  const [refreshing, setRefreshing] = useState(false);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;
  const resultRef = useRef(result);
  resultRef.current = result;

  const syncFromLiveRuleBook = useCallback(async ({ persistIfChanged = true } = {}) => {
    const current = resultRef.current;
    if (!current) {
      setMappedResult(null);
      return null;
    }

    const salesPivot = Array.isArray(current.salesPivot) ? current.salesPivot : [];
    const purchasesPivot = Array.isArray(current.purchasesPivot) ? current.purchasesPivot : [];
    const openingPivot = Array.isArray(current.openingPivot) ? current.openingPivot : [];
    const prevFingerprint = resultRuleBookFingerprint(current);

    setRefreshing(true);
    try {
      let remapped;
      if (salesPivot.length || purchasesPivot.length || openingPivot.length) {
        remapped = await remapClosingStockFromPivots({ salesPivot, purchasesPivot, openingPivot });
      } else {
        const live = await fetchClosingStockRuleBook();
        const local = mapPivotsWithRuleBook({
          salesPivot: [],
          purchasesPivot: [],
          openingPivot: [],
          ruleBook: live.ruleBook,
          ruleBookMeta: live,
        });
        remapped = {
          ...local,
          summary: {
            ruleBookFingerprint: live.ruleBookFingerprint,
            ruleBookProductCounts: live.ruleBookProductCounts,
            ruleBookProductTotal: live.ruleBookProductTotal,
            productsDisplayed: local.productsDisplayed,
            mappedProductCount: local.productsDisplayed,
            productsWithOpeningData: local.productsWithOpeningData ?? 0,
            productsWithSalesData: local.productsWithSalesData ?? 0,
            productsWithPurchaseData: local.productsWithPurchaseData ?? 0,
          },
        };
      }

      const updated = mergeRemapIntoResult(current, remapped);
      setMappedResult(updated);

      const nextFingerprint = remapped.ruleBookFingerprint ?? remapped.summary?.ruleBookFingerprint;
      if (persistIfChanged && nextFingerprint && nextFingerprint !== prevFingerprint) {
        onSyncedRef.current?.(updated);
      }
      return updated;
    } catch (err) {
      // Fallback: client-side map using freshly fetched Rule Book JSON.
      try {
        const live = await fetchClosingStockRuleBook();
        const local = mapPivotsWithRuleBook({
          salesPivot,
          purchasesPivot,
          openingPivot,
          ruleBook: live.ruleBook,
          ruleBookMeta: live,
        });
        const updated = mergeRemapIntoResult(current, {
          ...local,
          summary: {
            ruleBookFingerprint: live.ruleBookFingerprint,
            ruleBookProductCounts: live.ruleBookProductCounts,
            ruleBookProductTotal: live.ruleBookProductTotal,
            productsDisplayed: local.productsDisplayed,
            mappedProductCount: local.productsDisplayed,
            productsWithOpeningData: local.productsWithOpeningData ?? 0,
            productsWithSalesData: local.productsWithSalesData ?? 0,
            productsWithPurchaseData: local.productsWithPurchaseData ?? 0,
            unmappedProductCount: local.unmappedProducts?.length ?? 0,
          },
        });
        setMappedResult(updated);
        if (
          persistIfChanged &&
          live.ruleBookFingerprint &&
          live.ruleBookFingerprint !== prevFingerprint
        ) {
          onSyncedRef.current?.(updated);
        }
        return updated;
      } catch {
        // eslint-disable-next-line no-console
        console.error('Closing Stock Rule Book sync failed', err);
        setMappedResult(current);
        return current;
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!result) {
        setMappedResult(null);
        return;
      }
      await syncFromLiveRuleBook({ persistIfChanged: true });
      if (cancelled) return;
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [result, syncFromLiveRuleBook]);

  // Re-check when the user returns to the tab after editing the JSON Rule Book.
  useEffect(() => {
    if (!result) return undefined;

    function onVisible() {
      if (document.visibilityState === 'visible') {
        syncFromLiveRuleBook({ persistIfChanged: true });
      }
    }

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [result, syncFromLiveRuleBook]);

  return { mappedResult, refreshing, refreshRuleBook: syncFromLiveRuleBook };
}
