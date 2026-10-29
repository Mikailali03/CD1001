import type { QueryClient } from "@tanstack/react-query";
import {
  getGetCapitalOutlookQueryKey,
  getGetDashboardQueryKey,
  getGetInvestmentLedgerQueryKey,
  getGetPropertyMaintenanceInboxQueryKey,
  getGetPropertyReportQueryKey,
  getGetPropertySummaryQueryKey,
  getListAssetsQueryKey,
  getListPropertiesQueryKey,
} from "@workspace/api-client-react";

/**
 * Refreshes everything derived from a property's assets, tasks and records:
 * asset list, health summary, maintenance inbox, capital outlook, ledger,
 * report and dashboard. Prefix matching covers every param variant
 * (e.g. each ledger range).
 */
export function invalidatePropertyData(qc: QueryClient, propertyId: string | undefined) {
  const keys: ReadonlyArray<readonly unknown[]> = [
    getGetDashboardQueryKey(),
    ...(propertyId
      ? [
          getListAssetsQueryKey(propertyId),
          getGetPropertySummaryQueryKey(propertyId),
          getGetPropertyMaintenanceInboxQueryKey(propertyId),
          getGetCapitalOutlookQueryKey(propertyId),
          getGetInvestmentLedgerQueryKey(propertyId),
          getGetPropertyReportQueryKey(propertyId),
        ]
      : []),
  ];
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

/** Property list plus everything under one property (after create/edit/delete). */
export function invalidatePropertyAndList(qc: QueryClient, propertyId: string | undefined) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: getListPropertiesQueryKey() }),
    invalidatePropertyData(qc, propertyId),
  ]);
}
