export class ConnectionClosedError extends Error {
	// tslint:disable-next-line:variable-name
	private _previousError: Error | null;

	public constructor(message: string, previousError?: Error) {
		super(message);
		this._previousError = previousError || null;
	}

	public get previousError(): Error | null {
		return this._previousError;
	}
}
