import Papa from "papaparse";

export type CsvRow = Record<string, string>;

const normalizeKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const FARMER_HEADER_MAP: Record<string, string> = {
  firstname: "firstName",
  fname: "firstName",
  givenname: "firstName",
  lastname: "lastName",
  lname: "lastName",
  surname: "lastName",
  familyname: "lastName",
  phonenumber: "phoneNumber",
  phone: "phoneNumber",
  mobile: "phoneNumber",
  mobilenumber: "phoneNumber",
  msisdn: "phoneNumber",
  contact: "phoneNumber",
  contactnumber: "phoneNumber",
  nationalid: "nationalId",
  nid: "nationalId",
  idnumber: "nationalId",
  county: "county",
  subcounty: "subCounty",
  ward: "ward",
  village: "village",
};

export const PLOT_HEADER_MAP: Record<string, string> = {
  farmerphone: "farmerPhone",
  phone: "farmerPhone",
  phonenumber: "farmerPhone",
  mobile: "farmerPhone",
  name: "name",
  plotname: "name",
  latitude: "latitude",
  lat: "latitude",
  longitude: "longitude",
  lng: "longitude",
  lon: "longitude",
  long: "longitude",
  acreage: "acreage",
  area: "acreage",
  size: "acreage",
  hectares: "acreage",
  acres: "acreage",
  croptype: "cropType",
  crop: "cropType",
};

export const FARMER_REQUIRED = ["firstName", "lastName", "phoneNumber", "nationalId", "county"];
export const PLOT_REQUIRED = ["farmerPhone", "name", "latitude", "longitude", "acreage", "cropType"];

export function makeHeaderNormalizer(map: Record<string, string>) {
  return (h: string): string => map[normalizeKey(h)] ?? h.trim();
}

export const normalizeFarmerHeader = makeHeaderNormalizer(FARMER_HEADER_MAP);
export const normalizePlotHeader = makeHeaderNormalizer(PLOT_HEADER_MAP);

export interface ParseCsvOptions {
  normalizeHeader?: (h: string) => string;
  required?: string[];
}

export function parseCsv(text: string, options?: ParseCsvOptions): { rows: CsvRow[]; error?: string } {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => options?.normalizeHeader?.(h) ?? h.trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });

  const fatal = result.errors.find((e) => e.type === "Delimiter" || e.code === "UndetectableDelimiter");
  if (fatal) return { rows: [], error: fatal.message };

  const rows = result.data.filter((row) => Object.values(row).some((v) => v !== ""));
  if (rows.length === 0) return { rows: [] };

  if (options?.required) {
    const headers = Object.keys(rows[0]);
    const missing = options.required.filter((f) => !headers.includes(f));
    if (missing.length > 0) {
      return { rows: [], error: `Missing required column(s): ${missing.join(", ")}` };
    }
  }

  return { rows };
}
