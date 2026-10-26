// Erro com status HTTP e código estável que o front pode tratar (ex.: "already_chosen").
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}
