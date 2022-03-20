import pino from "pino";

export const logger = pino({
  name: "lute",
  level: "debug",
});
