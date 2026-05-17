import type { Request, Response, NextFunction, RequestHandler } from "express";

const asyncHandler = (
    fn: RequestHandler
): RequestHandler => {
    return (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        Promise.resolve(fn(req, res, next))
            .catch(next);
    };
};

// /asyncHandler receives a middleware/controller function and returns a new middleware function that wraps the original one with async error handling.

export default asyncHandler;