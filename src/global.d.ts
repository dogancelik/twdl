/* eslint-disable no-var */
import { ProcessStatus } from "./bin/util";
import { AllOptions } from "./options";

declare global {
	var argv: Partial<AllOptions>;
	var processStatus: ProcessStatus;
}

export { }
