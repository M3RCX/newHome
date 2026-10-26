import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { HttpError } from "../errors.js";

const TOKEN_TTL_SECONDS = 12 * 60 * 60;

export type AdminClaims = { sub: string; role: "admin" };

export function signAdminToken(email: string, secret: string) {
  const token = jwt.sign({ role: "admin" }, secret, {
    algorithm: "HS256",
    subject: email,
    expiresIn: TOKEN_TTL_SECONDS,
  });
  return { token, expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString() };
}

export function requireAdmin(secret: string): RequestHandler {
  return (req, res, next) => {
    const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) throw new HttpError(401, "unauthorized");
    try {
      const claims = jwt.verify(token, secret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
      if (claims.role !== "admin" || typeof claims.sub !== "string") throw new Error("claims");
      res.locals.admin = { sub: claims.sub, role: "admin" } satisfies AdminClaims;
    } catch {
      throw new HttpError(401, "unauthorized");
    }
    next();
  };
}
