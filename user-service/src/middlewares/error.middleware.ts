import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/error.js";

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.code,
            message: err.message
        })
    }

    console.error("UNHANDLED ERROR:", err)

    return res.status(500).json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong"
    });
}