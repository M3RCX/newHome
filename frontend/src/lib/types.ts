// Formato devolvido por GET /api/products (ver backend/src/repo.ts → PublicProduct).
export type ProductKind = "item" | "cota";
export type ContributionMode = "levar" | "pix" | "parte";
export type ProductStatus = "livre" | "escolhido";

export type Product = {
  slug: string;
  kind: ProductKind;
  room: string;
  name: string;
  spec: string;
  priceCents: number;
  purchaseUrl: string | null;
  imageUrl: string | null;
  status: ProductStatus;
};

export type NewContribution = {
  guestName: string;
  mode: ContributionMode;
  amountCents?: number;
};
