import SpotifyWebApi from "spotify-web-api-node";
import express from "express";
import open from "open";
import { KVStoreKey, retrieveValueOrThrow, storeValue } from "../kv";
import { logger } from "../logger";
import { config } from "../config";

const spotifyScopes = ["user-library-read"];

const waitForAuthorizationCode = (): Promise<string> => {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
  return new Promise((resolve, reject) => {
    try {
      const app = express();
      const server = app.listen(config.authServerPort);

      app.get("/", (request, response) => {
        const code = request.query.code as string | undefined;
        const error = request.query.error as string | undefined;

        const body = "<script>window.onload=window.close</script>";

        response.send(body);
        server.close();

        if (!code) {
          reject(error);
        } else {
          resolve(code);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
};

interface SpotifyUserCredentials {
  accessToken: string;
  refreshToken: string;
  expiresIn: Date;
}

interface SpotityApiCredentialsResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

const toSpotifyUserCredentials = <T extends SpotityApiCredentialsResponse>(
  body: T
): SpotifyUserCredentials => ({
  accessToken: body.access_token,
  refreshToken: body.refresh_token,
  expiresIn: new Date(body.expires_in),
});

const storeCredentials = async (credentials: SpotifyUserCredentials) => {
  await storeValue(KVStoreKey.spotifyAccessToken, credentials.accessToken);
  await storeValue(KVStoreKey.spotifyRefreshToken, credentials.refreshToken);
  await storeValue(
    KVStoreKey.spotifyAccessTokenExpiration,
    credentials.expiresIn
  );
  logger.info("Stored credentials", credentials);
};

const fetchCredentials = async (
  api: SpotifyWebApi
): Promise<SpotifyUserCredentials> => {
  const authorizationUrl = api.createAuthorizeURL(spotifyScopes, "");
  const [, code] = await Promise.all([
    open(authorizationUrl),
    waitForAuthorizationCode(),
  ]);
  logger.info("Received authorization code", { code });

  const { body } = await api.authorizationCodeGrant(code);
  const credentials = toSpotifyUserCredentials(body);
  logger.info("Received credentials", credentials);

  await storeCredentials(credentials);

  return credentials;
};

const retrieveStoredCredentials = async (): Promise<SpotifyUserCredentials> => ({
  accessToken: await retrieveValueOrThrow(KVStoreKey.spotifyAccessToken),
  refreshToken: await retrieveValueOrThrow(KVStoreKey.spotifyRefreshToken),
  expiresIn: await retrieveValueOrThrow(
    KVStoreKey.spotifyAccessTokenExpiration,
    (value) => new Date(value)
  ),
});

export const authorize = async (api: SpotifyWebApi): Promise<void> => {
  try {
    const credentials = await fetchCredentials(api);
    logger.info("Loaded credentials", credentials);
    api.setAccessToken(credentials.accessToken);
    api.setRefreshToken(credentials.refreshToken);
  } catch (error) {
    logger.error(error);
  }
};
