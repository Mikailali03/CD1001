/**
 * Published sources behind the lifespan, interval and cost figures in this
 * package. Every table entry points at one of these ids, so a figure can always
 * be traced back to where it came from.
 *
 * Published lifespans are ranges; where a source gives a range we use a value
 * inside it (usually the midpoint) and keep the range next to it.
 */
export type SourceId =
  | "NAHB_2007"
  | "INTERNACHI_LIFE"
  | "DOE_ENERGY_SAVER"
  | "ENERGY_STAR_HVAC"
  | "ENERGY_STAR_SEALING"
  | "USFA_SMOKE_ALARMS"
  | "ESFI_GFCI"
  | "CPSC_DRYER"
  | "CPSC_GARAGE_DOOR"
  | "NRCA_ROOF"
  | "IRC_GRADING"
  | "INTERNACHI_SOP"
  | "MANUFACTURER"
  | "CASA_ESTIMATE";

export type Source = {
  id: SourceId;
  title: string;
  publisher: string;
  year?: number;
  url?: string;
};

export const SOURCES: Record<SourceId, Source> = {
  NAHB_2007: {
    id: "NAHB_2007",
    title: "Study of Life Expectancy of Home Components",
    publisher: "National Association of Home Builders / Bank of America Home Equity",
    year: 2007,
  },
  INTERNACHI_LIFE: {
    id: "INTERNACHI_LIFE",
    title: "Estimated Life Expectancy Chart for Homes",
    publisher: "International Association of Certified Home Inspectors (InterNACHI)",
    url: "https://www.nachi.org/life-expectancy.htm",
  },
  DOE_ENERGY_SAVER: {
    id: "DOE_ENERGY_SAVER",
    title: "Energy Saver: maintaining air conditioners and water heaters",
    publisher: "U.S. Department of Energy",
  },
  ENERGY_STAR_HVAC: {
    id: "ENERGY_STAR_HVAC",
    title: "Heating & Cooling Maintenance Checklist",
    publisher: "ENERGY STAR (U.S. EPA)",
  },
  ENERGY_STAR_SEALING: {
    id: "ENERGY_STAR_SEALING",
    title: "Seal and Insulate with ENERGY STAR",
    publisher: "ENERGY STAR (U.S. EPA)",
  },
  USFA_SMOKE_ALARMS: {
    id: "USFA_SMOKE_ALARMS",
    title: "Smoke alarm testing and maintenance (test monthly; full check and battery change at least yearly)",
    publisher: "U.S. Fire Administration / NFPA",
  },
  ESFI_GFCI: {
    id: "ESFI_GFCI",
    title: "Ground Fault Circuit Interrupters: test monthly",
    publisher: "Electrical Safety Foundation International (ESFI)",
  },
  CPSC_DRYER: {
    id: "CPSC_DRYER",
    title: "Overheated clothes dryers can burn",
    publisher: "U.S. Consumer Product Safety Commission",
  },
  CPSC_GARAGE_DOOR: {
    id: "CPSC_GARAGE_DOOR",
    title: "Automatic residential garage door operator safety (16 CFR 1211): test reversal monthly",
    publisher: "U.S. Consumer Product Safety Commission",
  },
  NRCA_ROOF: {
    id: "NRCA_ROOF",
    title: "Roof inspection and maintenance guidance (inspect twice a year)",
    publisher: "National Roofing Contractors Association",
  },
  IRC_GRADING: {
    id: "IRC_GRADING",
    title: "International Residential Code R401.3: drainage (6 inches of fall in the first 10 feet)",
    publisher: "International Code Council",
  },
  INTERNACHI_SOP: {
    id: "INTERNACHI_SOP",
    title: "Home Maintenance Checklist",
    publisher: "International Association of Certified Home Inspectors (InterNACHI)",
  },
  MANUFACTURER: {
    id: "MANUFACTURER",
    title: "Typical manufacturer owner's-manual guidance",
    publisher: "Equipment manufacturers",
  },
  CASA_ESTIMATE: {
    id: "CASA_ESTIMATE",
    title: "Casa Dossier planning estimate (typical installed cost, U.S. national average). Not a quote.",
    publisher: "Casa Dossier",
    year: 2024,
  },
};
