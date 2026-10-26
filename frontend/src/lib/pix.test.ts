import { describe, expect, it } from "vitest";
import { crc16, normalizeKey, pixCode } from "./pix";

// Valores esperados gerados com o código original do design (design/casa-nova.html, pixCode).
const CASES: [{ key: string; name: string; city: string }, number, string][] = [
  [
    { key: "+55 (11) 98765-4321", name: "Letícia Ávila Conceição", city: "São Paulo" },
    17722,
    "00020126360014br.gov.bcb.pix0114+55119876543215204000053039865406177.225802BR5923Leticia Avila Conceicao6009Sao Paulo62070503***6304E2BF",
  ],
  [
    { key: "Leticia@Example.com", name: "Gui", city: "Campinas" },
    0,
    "00020126410014br.gov.bcb.pix0119leticia@example.com5204000053039865802BR5903Gui6008Campinas62070503***6304B70A",
  ],
  [
    { key: "123.456.789-09", name: "", city: "" },
    250000,
    "00020126330014br.gov.bcb.pix01111234567890952040000530398654072500.005802BR5909RECEBEDOR6006BRASIL62070503***63047A19",
  ],
  [
    {
      key: "7d9f0335-8dcc-4054-9bf9-0dbd61d36906",
      name: "Nome Muito Comprido Para O Campo Do Pix",
      city: "Rio de Janeiro Capital",
    },
    50,
    "00020126580014br.gov.bcb.pix01367d9f0335-8dcc-4054-9bf9-0dbd61d3690652040000530398654040.505802BR5925Nome Muito Comprido Para 6015Rio de Janeiro 62070503***63047F7B",
  ],
];

describe("pix", () => {
  it("calcula o CRC16-CCITT do vetor de teste padrão", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it.each(CASES)("gera o mesmo copia e cola que o design (%o, %i centavos)", (config, cents, expected) => {
    expect(pixCode(config, cents)).toBe(expected);
  });

  it("não gera código sem chave", () => {
    expect(pixCode({ key: "", name: "X", city: "Y" }, 1000)).toBe("");
  });

  it("normaliza chaves", () => {
    expect(normalizeKey(" +55 11 9999-0000 ")).toBe("+551199990000");
    expect(normalizeKey("12.345.678/0001-90")).toBe("12345678000190");
    expect(normalizeKey("A@B.COM")).toBe("a@b.com");
  });
});
