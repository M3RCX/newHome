import { describe, expect, it } from "vitest";
import { brl, brl0, daysLeft, paragraphs, parseBrlToCents } from "./format";

const nbsp = (s: string) => s.replace(/ /g, " ");

describe("format", () => {
  it("formata reais", () => {
    expect(nbsp(brl(17722))).toBe("R$ 177,22");
    expect(nbsp(brl0(22000))).toBe("R$ 220");
  });

  it.each([
    ["100", 10000],
    ["100,5", 10050],
    ["1.234,56", 123456],
    ["R$ 50", 5000],
    ["12.5", 1250],
    ["1.500", 150000],
    ["", 0],
    ["abc", 0],
    ["-10", 0],
  ])("converte %j para %i centavos", (input, cents) => {
    expect(parseBrlToCents(input)).toBe(cents);
  });

  it("conta dias até o evento", () => {
    const now = new Date(2026, 11, 1, 23, 30);
    expect(daysLeft("2026-12-19", now)).toBe(18);
    expect(daysLeft("2026-12-01", now)).toBe(0);
    expect(daysLeft("2026-11-30", now)).toBe(-1);
    expect(daysLeft("", now)).toBeNull();
  });

  it("separa parágrafos por linha em branco", () => {
    expect(paragraphs("um\nlinha\n\n  dois \n\n\n")).toEqual(["um\nlinha", "dois"]);
  });
});
