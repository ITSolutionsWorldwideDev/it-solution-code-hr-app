// src/lib/auth.ts
import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;

export interface AuthTokenPayload extends JwtPayload {
  id: number;
  email: string;
}

export function createJWT(user: any) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email },
    JWT_ACCESS_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyJWT(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}
  