import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../utils/error.js";

export function getUserContext(req: Request, _res: Response, next: NextFunction) {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
        return next(new UnauthorizedError('User context missing'))
    }

    req.user = { id: userId }
    next()
}