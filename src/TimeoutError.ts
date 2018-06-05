export class TimeoutError extends Error {
	public constructor(msg?: string) {
		super(msg);
		Object.setPrototypeOf(this, TimeoutError.prototype);
	}
}
