import { RequestHandler } from "express";
import axios, { AxiosRequestConfig } from "axios";

import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { ServiceUnavailableError } from "../utils/error.js";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

class CircuitBreaker {
    serviceName: string;
    threshold: number;
    timeout: number;
    failureCount: number;
    state: CircuitState;
    nextAttempt: number;

    constructor(
        serviceName: string,
        threshold = config.CIRCUIT_BREAKER_THRESHOLD,
        timeout = config.CIRCUIT_BREAKER_TIMEOUT
    ) {
        this.serviceName = serviceName;
        this.threshold = threshold;
        this.timeout = timeout;
        this.failureCount = 0;
        this.state = "CLOSED";
        this.nextAttempt = Date.now();
    }

    async execute<T>(request: () => Promise<T>): Promise<T> {
        if (this.state === "OPEN") {
            if (Date.now() < this.nextAttempt) {
                throw new ServiceUnavailableError(
                    `Service ${this.serviceName} is temporarily unavailable. Circuit breaker is OPEN`
                );
            }

            this.state = "HALF_OPEN";

            logger.info(
                `Circuit breaker HALF_OPEN for ${this.serviceName}`
            );
        }

        try {
            const response = await request();

            this.onSuccess();

            return response;
        } catch (error) {
            this.onFailure();

            throw error;
        }
    }

    onSuccess(): void {
        this.failureCount = 0;

        if (this.state === "HALF_OPEN") {
            this.state = "CLOSED";

            logger.info(
                `Circuit breaker CLOSED for ${this.serviceName}`
            );
        }
    }

    onFailure(): void {
        this.failureCount++;

        logger.warn(
            `Circuit breaker failure for ${this.serviceName}. Failure count: ${this.failureCount}`
        );

        if (this.failureCount >= this.threshold) {
            this.state = "OPEN";
            this.nextAttempt = Date.now() + this.timeout;

            logger.error(
                `Circuit breaker OPEN for ${this.serviceName}`
            );
        }
    }

    getState() {
        return {
            service: this.serviceName,
            state: this.state,
            failureCount: this.failureCount,
            nextAttempt: this.nextAttempt,
        };
    }
}

const circuitBreakers: Record<string, CircuitBreaker> = {
    userService: new CircuitBreaker("user-service"),
    bookingService: new CircuitBreaker("booking-service"),
    searchService: new CircuitBreaker("search-service"),
    adminService: new CircuitBreaker("admin-service"),
    paymentService: new CircuitBreaker("payment-service"),
    inventoryService: new CircuitBreaker("inventory-service")
};

interface ForwardResponse {
    status: number;
    data: unknown;
    headers: Record<string, string>;
}

async function forwardRequest(
    serviceUrl: string,
    path: string,
    method: string,
    data: unknown,
    headers: Record<string, unknown>,
    circuitBreaker: CircuitBreaker
): Promise<ForwardResponse> {
    const url = `${serviceUrl}${path}`;

    const forwardedHeaders = { ...headers };

    delete forwardedHeaders.host;
    delete forwardedHeaders["content-length"];

    const requestConfig: AxiosRequestConfig = {
        method,
        url,
        timeout: config.SERVICE_TIMEOUT_MS,
        headers: forwardedHeaders as any,
        validateStatus: () => true,
        maxRedirects: 5,
    };

    if (method !== "GET" && method !== "DELETE" && data) {
        requestConfig.data = data;
    }

    if ((method === "GET" || method === "DELETE") && data) {
        requestConfig.params = data;
    }

    logger.debug(`Forwarding ${method} ${url}`, {
        headers: requestConfig.headers,
        hasData: !!data,
        timeout: config.SERVICE_TIMEOUT_MS,
    });

    try {
        const response = await circuitBreaker.execute(() =>
            axios(requestConfig)
        );

        return {
            status: response.status,
            data: response.data,
            headers: response.headers as Record<string, string>,
        };
    } catch (error: any) {
        logger.error(`Error forwarding to ${serviceUrl}`, {
            message: error.message,
            code: error.code,
            url,
            method,
            timeout: config.SERVICE_TIMEOUT_MS,
        });

        /**
         * Request timeout
         */
        if (
            error.code === "ECONNABORTED" ||
            error.code === "ETIMEDOUT"
        ) {
            throw new ServiceUnavailableError(
                `Request to ${serviceUrl} timed out after ${config.SERVICE_TIMEOUT_MS}ms`
            );
        }

        /**
         * Service unavailable
         */
        if (
            error.code === "ECONNREFUSED" ||
            error.code === "ENOTFOUND" ||
            error.code === "EHOSTUNREACH"
        ) {
            throw new ServiceUnavailableError(
                `Cannot connect to ${serviceUrl}. Service may be unavailable`
            );
        }

        /**
         * Axios received response from downstream service
         */
        if (error.response) {
            return {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers,
            };
        }

        /**
         * Unknown error
         */
        throw new ServiceUnavailableError(
            `Unexpected error communicating with ${serviceUrl}`
        );
    }
}

export function createProxy(
    serviceName: string,
    serviceUrl: string
): RequestHandler {
    const circuitBreaker = circuitBreakers[serviceName];

    if (!circuitBreaker) {
        throw new Error(
            `No circuit breaker found for service ${serviceName}`
        );
    }

    return async (req, res, next) => {
        try {
            /**
             * Gateway:
             * /api/users/user/profile
             *
             * Service:
             * /user/profile
             */

            logger.info(`Incoming request: ${req.method} ${req.path}`);

            const pathParts = req.path
                .split("/")
                .filter(Boolean);

            const servicePrefix =
                serviceName === "paymentService"
                    ? "/api/payment/"
                    : serviceName === "inventoryService"
                    ? "/api/inventory/"
                    : "/api/v1/";
            const servicePath = servicePrefix + pathParts.slice(1).join("/");

            const queryString = req.url.includes("?")
                ? req.url.substring(req.url.indexOf("?"))
                : "";

            const requestBody = (req as any).rawBody || req.body;

            const result = await forwardRequest(
                serviceUrl,
                servicePath + queryString,
                req.method,
                req.method === "GET" || req.method === "DELETE"
                    ? undefined
                    : requestBody,
                req.headers as Record<string, unknown>,
                circuitBreaker
            );

            if (!result) {
                throw new ServiceUnavailableError(
                    "No response from downstream service"
                );
            }

            const excludeHeaders = [
                "connection",
                "keep-alive",
                "transfer-encoding",
            ];

            Object.keys(result.headers).forEach((key) => {
                if (
                    !excludeHeaders.includes(
                        key.toLowerCase()
                    )
                ) {
                    res.setHeader(
                        key,
                        result.headers[key]
                    );
                }
            });

            res.status(result.status).json(result.data);
        } catch (error) {
            next(error);
        }
    };
}