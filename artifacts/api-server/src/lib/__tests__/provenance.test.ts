import { describe, it, expect } from "vitest";
import { isReservedCompanyName } from "../provenance";

describe("isReservedCompanyName", () => {
  it.each(["CasaService", "casaservice", "Casa Service", " casa-service ", "CASA_SERVICE"])(
    "reserves %j",
    (name) => expect(isReservedCompanyName(name)).toBe(true),
  );

  it.each(["Casa Plumbing", "ServiceMaster", "", null, undefined])("allows %j", (name) =>
    expect(isReservedCompanyName(name)).toBe(false),
  );
});
