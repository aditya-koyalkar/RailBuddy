async function withRetry<T>(
    fn: () => Promise<T>,
    retries = 3
): Promise<T> {
    let lastError;

    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError;
}

export default withRetry;