import * as dotenv from "dotenv";
import * as env from "env-var";

dotenv.config();

export const config = {
  spotifyClientId: env.get("SPOTIFY_CLIENT_ID").required().asString(),
  spotifyClientSecret: env.get("SPOTIFY_CLIENT_SECRET").required().asString(),
  authServerPort: env.get("AUTH_SERVER_PORT").default(3333).asPortNumber(),
};
