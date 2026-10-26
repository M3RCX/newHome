// Corpo já lido pelo serverless-http (Netlify Functions). Lá a requisição chega marcada como
// terminada, então body-parser e multer não conseguem ler o stream: eles usam este buffer.
import type { Request, RequestHandler } from "express";
import { HttpError } from "./errors.js";

const rawBodies = new WeakMap<Request, Buffer>();

export const getRawBody = (req: Request) => rawBodies.get(req);

// Antes do express.json: guarda o Buffer que o serverless-http colocou em req.body.
export const captureRawBody: RequestHandler = (req, _res, next) => {
  if (Buffer.isBuffer(req.body)) rawBodies.set(req, req.body);
  next();
};

// Depois do express.json: ele não relê o stream e deixa o Buffer (ou undefined) em req.body.
// Nesse caso interpretamos o buffer guardado; multipart fica para o multer.
export function jsonFromRawBody(limitBytes: number): RequestHandler {
  return (req, _res, next) => {
    const raw = rawBodies.get(req);
    if (raw && (req.body === raw || req.body === undefined)) {
      req.body = undefined;
      if (raw.length && req.is("application/json")) {
        if (raw.length > limitBytes) throw new HttpError(413, "body_too_large");
        try {
          req.body = JSON.parse(raw.toString("utf8"));
        } catch {
          throw new HttpError(400, "invalid_json");
        }
      }
    }
    next();
  };
}
