import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/error.js";
import userClient from "../services/userClient.js";
import { logger } from "../config/logger.js";

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
        return next(new UnauthorizedError("User context missing"));
    }

    try {
        const user = await userClient.getUserProfile(userId);

        if (!user || !user.isAdmin) {
            logger.warn(`Admin access denied for user ${userId} (isAdmin: ${user?.isAdmin})`);
            return next(new ForbiddenError("Access denied. Admin privileges required"));
        }

        req.user = { id: userId, isAdmin: true };
        next();
    } catch (error: any) {
        logger.error(`Failed to verify admin status for user ${userId}`, { error: error.message });
        return next(new ForbiddenError("Failed to verify admin authorization"));
    }
}
