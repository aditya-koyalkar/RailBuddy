import type { NextFunction, Request, Response } from "express";

export const reqLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    req.on("close", () => {
        const duration = Date.now() - start;
        console.log(`[${req.method}] [${req.originalUrl}] - status: [${res.statusCode}] - ${duration}ms`);
    });
    next();
};
