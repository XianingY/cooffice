import { describe, expect, it } from "vitest";
import { parseCsv, readCsvFile } from "../../src/adapters/csv/salesCsv";

describe("parseCsv", () => {
  it("parses a BOM-prefixed CRLF file into headers and rows", () => {
    const text = "\uFEFFregion,previous,current\r\n华东,100,120\r\n华西,90,100\r\n";
    expect(parseCsv(text)).toEqual({
      headers: ["region", "previous", "current"],
      rows: [
        ["华东", "100", "120"],
        ["华西", "90", "100"],
      ],
      source: "csv",
    });
  });

  it("handles quoted commas, embedded newlines and escaped quotes", () => {
    const text = 'region,previous,current\n"华东,北区",100,"120\n备注 ""已核对"""\n';
    expect(parseCsv(text).rows[0]).toEqual(["华东,北区", "100", '120\n备注 "已核对"']);
  });

  it("does not create an extra row for a trailing newline", () => {
    expect(parseCsv("a,b\n1,2\n").rows).toEqual([["1", "2"]]);
    expect(parseCsv("a,b\n1,2").rows).toEqual([["1", "2"]]);
  });

  it("rejects missing headers and unclosed quotes", () => {
    expect(() => parseCsv("")).toThrow("表头");
    expect(() => parseCsv('a,b\n"未闭合')).toThrow("引号");
  });
});

describe("readCsvFile", () => {
  const fakeFile = (name: string, size: number, text: string) =>
    ({ name, size, text: async () => text }) as unknown as File;

  it("rejects non-csv extensions and oversized files", async () => {
    await expect(readCsvFile(fakeFile("data.xlsx", 10, "a,b\n1,2"))).rejects.toThrow("只支持 .csv 文件");
    await expect(readCsvFile(fakeFile("data.csv", 10 * 1024 * 1024 + 1, "a,b\n1,2"))).rejects.toThrow("10 MiB");
  });

  it("reads a valid CSV file", async () => {
    await expect(readCsvFile(fakeFile("data.csv", 20, "region,previous,current\n华东,100,120"))).resolves.toEqual({
      headers: ["region", "previous", "current"],
      rows: [["华东", "100", "120"]],
      source: "csv",
    });
  });
});
