import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../utils/error.js";
import { verifyAccessTOken } from "../utils/auth.js";
import type { JwtPayload } from "jsonwebtoken";
interface AccessTokenPayload extends JwtPayload {
    id: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer")) {
        return next(new UnauthorizedError("Authorization token is mising"))
    }
    const accessToken = authHeader.split(" ")[1];
    try {
        const decoded = verifyAccessTOken(accessToken || "") as AccessTokenPayload
        req.user = {
            id: decoded.id
        }
        next();
    }
    catch (e) {
        return next(new UnauthorizedError("Invalid or expired access token"));

    }
}