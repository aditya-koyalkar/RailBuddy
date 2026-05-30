import { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../utils/error";

export function notFound(req: Request, res: Response, next: NextFunction) {
    next(new NotFoundError(`Route ${req.method} ${req.path} not Found`))
}