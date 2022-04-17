import * as dotenv from "dotenv";
import * as env from "env-var";

dotenv.config();

export const config = {
  authServerPort: env.get("AUTH_SERVER_PORT").default(3333).asPortNumber(),
  queueDashboardPort: env.get("QUEUE_DASHBOARD_PORT").default(3222).asInt(),
  redisHost: env.get("REDIS_HOST").required().asString(),
  redisPort: env.get("REDIS_PORT").required().asInt(),
  redisPassword: env.get("REDIS_PASSWORD").required().asString(),
  spotifyClientId: env.get("SPOTIFY_CLIENT_ID").required().asString(),
  spotifyClientSecret: env.get("SPOTIFY_CLIENT_SECRET").required().asString(),
};
