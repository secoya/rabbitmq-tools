export declare class ConnectionClosedError extends Error {
    private _previousError;
    constructor(message: string, previousError?: Error);
    readonly previousError: Error | null;
}
