import { describe, expect, it } from "vitest";
import { assertNumbersPreserved, extractNumericTokens } from "../../src/core/aiGuard";

describe("extractNumericTokens", () => {
  it("extracts integers, decimals and percentages in reading order", () => {
    expect(extractNumericTokens("总额 300 万元，同比增长 20.00%，第一名华东")).toEqual(["300", "20.00"]);
    expect(extractNumericTokens("无数字的文本")).toEqual([]);
    expect(extractNumericTokens("-5 到 1,000")).toEqual(["-5", "1,000"]);
  });
});

describe("assertNumbersPreserved", () => {
  it("accepts text whose numeric tokens are unchanged", () => {
    expect(() => assertNumbersPreserved("总额 300 万元", "本期总额为 300 万元整")).not.toThrow();
    expect(() => assertNumbersPreserved("无数字", "纯文字润色")).not.toThrow();
  });

  it("rejects any change to numeric tokens", () => {
    expect(() => assertNumbersPreserved("总额 300 万元", "总额 400 万元")).toThrow("数值");
    expect(() => assertNumbersPreserved("增长 20.00%", "增长 19.00%")).toThrow("数值");
    expect(() => assertNumbersPreserved("总额 300 万元", "总额增长")).toThrow("数值");
  });

  it("rejects newly introduced numbers", () => {
    expect(() => assertNumbersPreserved("总额 300 万元", "总额 300 万元，环比 5%")).toThrow("数值");
  });

  it("rejects altered or dropped units attached to numbers", () => {
    expect(() => assertNumbersPreserved("增长 20.00%", "增长 20.00")).toThrow("数值");
    expect(() => assertNumbersPreserved("总额 300 万元", "总额 300 亿元")).toThrow("数值");
  });
});
