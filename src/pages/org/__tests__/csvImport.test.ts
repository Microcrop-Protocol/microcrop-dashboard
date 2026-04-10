import { describe, it, expect } from "vitest";
import {
  parseCsv,
  normalizeFarmerHeader,
  normalizePlotHeader,
  FARMER_REQUIRED,
  PLOT_REQUIRED,
} from "../csvImport";

describe("normalizeFarmerHeader", () => {
  it("passes canonical names through unchanged", () => {
    expect(normalizeFarmerHeader("firstName")).toBe("firstName");
    expect(normalizeFarmerHeader("phoneNumber")).toBe("phoneNumber");
    expect(normalizeFarmerHeader("nationalId")).toBe("nationalId");
    expect(normalizeFarmerHeader("county")).toBe("county");
  });

  it("is case-insensitive", () => {
    expect(normalizeFarmerHeader("COUNTY")).toBe("county");
    expect(normalizeFarmerHeader("County")).toBe("county");
    expect(normalizeFarmerHeader("FIRSTNAME")).toBe("firstName");
    expect(normalizeFarmerHeader("NationalID")).toBe("nationalId");
  });

  it("strips whitespace, underscores, and punctuation", () => {
    expect(normalizeFarmerHeader("first name")).toBe("firstName");
    expect(normalizeFarmerHeader("first_name")).toBe("firstName");
    expect(normalizeFarmerHeader("First Name")).toBe("firstName");
    expect(normalizeFarmerHeader("  county  ")).toBe("county");
    expect(normalizeFarmerHeader("National-ID")).toBe("nationalId");
  });

  it("maps common phoneNumber aliases", () => {
    expect(normalizeFarmerHeader("phone")).toBe("phoneNumber");
    expect(normalizeFarmerHeader("Phone")).toBe("phoneNumber");
    expect(normalizeFarmerHeader("mobile")).toBe("phoneNumber");
    expect(normalizeFarmerHeader("mobile number")).toBe("phoneNumber");
    expect(normalizeFarmerHeader("MSISDN")).toBe("phoneNumber");
    expect(normalizeFarmerHeader("contact")).toBe("phoneNumber");
  });

  it("maps common nationalId aliases", () => {
    expect(normalizeFarmerHeader("nid")).toBe("nationalId");
    expect(normalizeFarmerHeader("ID number")).toBe("nationalId");
  });

  it("maps surname/family name to lastName", () => {
    expect(normalizeFarmerHeader("Surname")).toBe("lastName");
    expect(normalizeFarmerHeader("family name")).toBe("lastName");
  });

  it("maps subcounty variants to subCounty", () => {
    expect(normalizeFarmerHeader("sub county")).toBe("subCounty");
    expect(normalizeFarmerHeader("Sub-County")).toBe("subCounty");
    expect(normalizeFarmerHeader("SUBCOUNTY")).toBe("subCounty");
  });

  it("returns trimmed original for unknown headers", () => {
    expect(normalizeFarmerHeader("  weirdField  ")).toBe("weirdField");
    expect(normalizeFarmerHeader("notes")).toBe("notes");
  });
});

describe("normalizePlotHeader", () => {
  it("maps coordinate aliases", () => {
    expect(normalizePlotHeader("lat")).toBe("latitude");
    expect(normalizePlotHeader("LAT")).toBe("latitude");
    expect(normalizePlotHeader("lng")).toBe("longitude");
    expect(normalizePlotHeader("lon")).toBe("longitude");
    expect(normalizePlotHeader("long")).toBe("longitude");
  });

  it("maps crop type aliases", () => {
    expect(normalizePlotHeader("crop")).toBe("cropType");
    expect(normalizePlotHeader("Crop Type")).toBe("cropType");
    expect(normalizePlotHeader("crop_type")).toBe("cropType");
  });

  it("maps acreage size aliases", () => {
    expect(normalizePlotHeader("area")).toBe("acreage");
    expect(normalizePlotHeader("size")).toBe("acreage");
    expect(normalizePlotHeader("hectares")).toBe("acreage");
    expect(normalizePlotHeader("Acres")).toBe("acreage");
  });

  it("maps farmer phone variants", () => {
    expect(normalizePlotHeader("farmer phone")).toBe("farmerPhone");
    expect(normalizePlotHeader("farmerPhone")).toBe("farmerPhone");
    expect(normalizePlotHeader("phone")).toBe("farmerPhone");
  });
});

describe("parseCsv", () => {
  it("parses a basic farmers CSV", () => {
    const csv = [
      "firstName,lastName,phoneNumber,nationalId,county",
      "John,Doe,+254712345678,12345678,Nakuru",
      "Jane,Smith,+254798765432,87654321,Kisumu",
    ].join("\n");

    const { rows, error } = parseCsv(csv, {
      normalizeHeader: normalizeFarmerHeader,
      required: FARMER_REQUIRED,
    });

    expect(error).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      firstName: "John",
      lastName: "Doe",
      phoneNumber: "+254712345678",
      nationalId: "12345678",
      county: "Nakuru",
    });
    expect(rows[1].county).toBe("Kisumu");
  });

  it("strips UTF-8 BOM from Excel-exported CSVs", () => {
    const csv =
      "\uFEFFfirstName,lastName,phoneNumber,nationalId,county\n" +
      "John,Doe,+254712345678,12345678,Nakuru";

    const { rows, error } = parseCsv(csv, {
      normalizeHeader: normalizeFarmerHeader,
      required: FARMER_REQUIRED,
    });

    expect(error).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows[0].firstName).toBe("John");
    expect(rows[0].county).toBe("Nakuru");
  });

  it("handles CRLF line endings", () => {
    const csv =
      "firstName,lastName,phoneNumber,nationalId,county\r\n" +
      "John,Doe,+254712345678,12345678,Nakuru\r\n" +
      "Jane,Smith,+254798765432,87654321,Kisumu\r\n";

    const { rows, error } = parseCsv(csv, {
      normalizeHeader: normalizeFarmerHeader,
      required: FARMER_REQUIRED,
    });

    expect(error).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ lastName: "Smith", county: "Kisumu" });
  });

  it("handles quoted fields that contain commas", () => {
    const csv = [
      "name,farmerPhone,latitude,longitude,acreage,cropType",
      '"Plot A, North","+254712345678",-0.3031,36.08,2.5,Maize',
    ].join("\n");

    const { rows, error } = parseCsv(csv, {
      normalizeHeader: normalizePlotHeader,
      required: PLOT_REQUIRED,
    });

    expect(error).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Plot A, North");
    expect(rows[0].latitude).toBe("-0.3031");
  });

  it("normalizes headers so capitalized County passes validation", () => {
    const csv = [
      "First Name,Last Name,Phone,National ID,County",
      "John,Doe,+254712345678,12345678,Nakuru",
    ].join("\n");

    const { rows, error } = parseCsv(csv, {
      normalizeHeader: normalizeFarmerHeader,
      required: FARMER_REQUIRED,
    });

    expect(error).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      firstName: "John",
      lastName: "Doe",
      phoneNumber: "+254712345678",
      nationalId: "12345678",
      county: "Nakuru",
    });
  });

  it("reports a missing required column before hitting the backend", () => {
    const csv = [
      "firstName,lastName,phoneNumber,nationalId",
      "John,Doe,+254712345678,12345678",
    ].join("\n");

    const { rows, error } = parseCsv(csv, {
      normalizeHeader: normalizeFarmerHeader,
      required: FARMER_REQUIRED,
    });

    expect(rows).toHaveLength(0);
    expect(error).toBe("Missing required column(s): county");
  });

  it("lists every missing required column", () => {
    const csv = ["firstName,lastName", "John,Doe"].join("\n");

    const { error } = parseCsv(csv, {
      normalizeHeader: normalizeFarmerHeader,
      required: FARMER_REQUIRED,
    });

    expect(error).toBe("Missing required column(s): phoneNumber, nationalId, county");
  });

  it("filters out entirely empty rows", () => {
    const csv = [
      "firstName,lastName,phoneNumber,nationalId,county",
      "John,Doe,+254712345678,12345678,Nakuru",
      ",,,,",
      "Jane,Smith,+254798765432,87654321,Kisumu",
    ].join("\n");

    const { rows, error } = parseCsv(csv, {
      normalizeHeader: normalizeFarmerHeader,
      required: FARMER_REQUIRED,
    });

    expect(error).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0].firstName).toBe("John");
    expect(rows[1].firstName).toBe("Jane");
  });

  it("trims whitespace from cell values", () => {
    const csv = [
      "firstName,lastName,phoneNumber,nationalId,county",
      "  John ,  Doe ,  +254712345678 ,  12345678 ,  Nakuru ",
    ].join("\n");

    const { rows } = parseCsv(csv, {
      normalizeHeader: normalizeFarmerHeader,
      required: FARMER_REQUIRED,
    });

    expect(rows[0]).toMatchObject({
      firstName: "John",
      lastName: "Doe",
      phoneNumber: "+254712345678",
      nationalId: "12345678",
      county: "Nakuru",
    });
  });

  it("returns empty rows with no error for header-only CSV", () => {
    const csv = "firstName,lastName,phoneNumber,nationalId,county";
    const { rows, error } = parseCsv(csv, {
      normalizeHeader: normalizeFarmerHeader,
      required: FARMER_REQUIRED,
    });

    expect(rows).toHaveLength(0);
    expect(error).toBeUndefined();
  });
});
