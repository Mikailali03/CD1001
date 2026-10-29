import type { QueryClient } from "@tanstack/react-query";
import {
  getListAssetsQueryKey,
  getListPropertiesQueryKey,
  getGetPropertyQueryKey,
  getGetPropertySummaryQueryKey,
  getGetPropertyMaintenanceInboxQueryKey,
  getGetInvestmentLedgerQueryKey,
  getGetCapitalOutlookQueryKey,
} from "@workspace/api-client-react";

/**
 * Completing a task writes a service record and reschedules the task, so the
 * property's summary, inbox, ledger and asset views all move. Ledger and
 * asset keys are prefixes, so every range / includeRetired variant refreshes.
 */
export function invalidateAfterTaskCompletion(queryClient: QueryClient, propertyId: string) {
  for (const queryKey of [
    getGetPropertyMaintenanceInboxQueryKey(propertyId),
    getGetPropertySummaryQueryKey(propertyId),
    getGetPropertyQueryKey(propertyId),
    getListPropertiesQueryKey(),
    getListAssetsQueryKey(propertyId),
    getGetInvestmentLedgerQueryKey(propertyId),
    getGetCapitalOutlookQueryKey(propertyId),
  ]) {
    queryClient.invalidateQueries({ queryKey });
  }
}
