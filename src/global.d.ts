/* eslint-disable no-var */
import { ProcessStatus } from "./bin/util.js";
import { AllOptions } from "./options.js";

declare global {
	var argv: Partial<AllOptions>;
	var processStatus: ProcessStatus;
}

export { }
