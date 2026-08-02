export class AppError extends Error {
    statusCode: number;
    code: string;

    constructor(message: string, statusCode: number, code: string) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

export class BadRequestError extends AppError {
    constructor(message = "Bad Request", code = "BAD_REQUEST") {
        super(message, 400, code);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
        super(message, 401, code);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "Forbidden", code = "FORBIDDEN") {
        super(message, 403, code);
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Resource Not Found", code = "NOT_FOUND") {
        super(message, 404, code);
    }
}

export class ConflictError extends AppError {
    constructor(message = "Conflict", code = "CONFLICT") {
        super(message, 409, code);
    }
}

export class InternalServerError extends AppError {
    constructor(message = "Internal Server Error", code = "INTERNAL_SERVER_ERROR") {
        super(message, 500, code);
    }
}
