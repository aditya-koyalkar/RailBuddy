import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../utils/error.js";
import type { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken"
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";


export function requireAuth(req: Request, _res: Response, next: NextFunction) {

    let accessToken = req.cookies?.accessToken;
    if (!accessToken && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        accessToken = req.headers.authorization.split(" ")[1];
    }

    if (!accessToken) {
        throw new UnauthorizedError("Authorization token missing")
    }
    try {
        const payload = jwt.verify(accessToken, config.JWT_ACCESS_SECRET) as JwtPayload
        if (!payload.id) {
            throw new UnauthorizedError("Invalid token payload")
        }
        req.headers['x-user-id'] = payload.id.toString();
        logger.debug(`User ${payload.id} authenticated successfully`)
        next();
    }
    catch (e) {
        return next(new UnauthorizedError("Invalid or expired access token"));

    }
}