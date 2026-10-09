import type { Capability } from "../types";
import type { ConfigurationContext } from "./context";
import { interpretConfigurationRequest } from "./interpret";
import type { ConfigurationOutcome } from "./intent";

export type ConfigurationInput = { message: string; context: ConfigurationContext };

export const configurationCapability: Capability<ConfigurationInput, ConfigurationOutcome> = {
  id: "configuration",
  run(input, generate) {
    return interpretConfigurationRequest(input.message, input.context, generate);
  },
};
