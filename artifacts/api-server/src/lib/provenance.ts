// "CasaService" marks work done and verified by the Casa Dossier service team.
// Only the marketplace completion route may use it; homeowner-entered records can't.
export function isReservedCompanyName(name: string | null | undefined): boolean {
  if (!name) return false;
  return name.toLowerCase().replace(/[\s\-_.]/g, "") === "casaservice";
}

export const RESERVED_COMPANY_NAME_ERROR =
  '"CasaService" is reserved for work verified by the Casa Dossier service team.';
