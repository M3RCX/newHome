// Pix "copia e cola" (BR Code EMV estático), portado do design.

export type PixConfig = { key: string; name: string; city: string };

const emv = (id: string, value: string) => id + String(value.length).padStart(2, "0") + value;

// Nome/cidade: sem acento, só [A-Za-z0-9 .-], com tamanho máximo do padrão.
const clean = (s: string, max: number) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .-]/g, "")
    .trim()
    .slice(0, max);

// CRC16-CCITT (poly 0x1021, init 0xFFFF), exigido no campo 63 do BR Code.
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// E-mail em minúsculas; telefone/CPF/CNPJ só dígitos (mantém o + do telefone); chave aleatória como está.
export function normalizeKey(key: string): string {
  const k = key.trim();
  if (k.includes("@")) return k.toLowerCase();
  if (/^[\d.\-/() +]+$/.test(k)) {
    const digits = k.replace(/\D/g, "");
    return k.startsWith("+") ? `+${digits}` : digits;
  }
  return k;
}

// amountCents 0 → Pix sem valor (o pagador digita).
export function pixCode(config: PixConfig, amountCents: number): string {
  if (!config.key) return "";
  const account = emv("00", "br.gov.bcb.pix") + emv("01", normalizeKey(config.key));
  const payload =
    emv("00", "01") +
    emv("26", account) +
    emv("52", "0000") +
    emv("53", "986") +
    (amountCents > 0 ? emv("54", (amountCents / 100).toFixed(2)) : "") +
    emv("58", "BR") +
    emv("59", clean(config.name, 25) || "RECEBEDOR") +
    emv("60", clean(config.city, 15) || "BRASIL") +
    emv("62", emv("05", "***")) +
    "6304";
  return payload + crc16(payload);
}
