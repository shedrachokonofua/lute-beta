import SpotifyWebApi from "spotify-web-api-node";
import { config } from "../config";
import { database } from "../database";
import { logger } from "../logger";
import { authorize } from "./auth";

const spotifyApi = new SpotifyWebApi({
  clientId: config.spotifyClientId,
  clientSecret: config.spotifyClientSecret,
  redirectUri: `http://localhost:${config.authServerPort}/`,
});

const connectArtist = (artist: { id: string; name: string }) => ({
  where: {
    spotifyId: artist.id,
  },
  create: {
    spotifyId: artist.id,
    name: artist.name,
  },
});

export const loadUserLibrary = async (): Promise<void> => {
  await authorize(spotifyApi);
  for (let index = 0; index < 40; index++) {
    const {
      body: { items: tracks },
    } = await spotifyApi.getMySavedTracks({
      limit: 50,
      offset: index * 50,
    });

    for (const { track } of tracks) {
      const data = {
        spotifyId: track.id,
        name: track.name,
        spotifyPopularity: track.popularity,
        album: {
          connectOrCreate: {
            where: {
              spotifyId: track.album.id,
            },
            create: {
              spotifyId: track.album.id,
              name: track.album.name,
              artists: {
                connectOrCreate: track.album.artists.map((artist) =>
                  connectArtist(artist)
                ),
              },
            },
          },
        },
        artists: {
          connectOrCreate: track.artists.map((artist) => connectArtist(artist)),
        },
      };
      await database.track.upsert({
        where: {
          spotifyId: track.id,
        },
        update: data,
        create: data,
      });
    }

    logger.info(`Loaded ${index * 50 + 50} tracks`);
  }
};
