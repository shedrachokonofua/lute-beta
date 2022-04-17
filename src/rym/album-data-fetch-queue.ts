import Queue from "bull";
import { config } from "../config";
import { database } from "../database";
import { logger } from "../logger";
import { Album, Artist } from "@prisma/client";
import { isBefore, subDays } from "date-fns";

export const albumDataFetchQueue = new Queue<Album & { artists: Artist[] }>(
  "album-data-fetch",
  {
    redis: {
      host: config.redisHost,
      port: config.redisPort,
      password: config.redisPassword,
    },
    limiter: {
      max: 1,
      duration: 5 * 1000,
    },
    settings: {
      backoffStrategies: {},
    },
    defaultJobOptions: {
      backoff: 60 * 1000,
    },
  }
);

albumDataFetchQueue.on("failed", (error) => {
  logger.error("Stopping processing", error);
  albumDataFetchQueue
    .pause()
    .then(() => {
      logger.info("Paused album data fetch queue");
    })
    .catch((error) => {
      logger.error("Couldn't pause album data fetch queue", error);
    });
});

const isOlderThan1Day = (date: Date) =>
  isBefore(new Date(date), subDays(new Date(), 1));

export const pushToAlbumDataFetchQueue = async (
  album: Album & { artists: Artist[] }
): Promise<void> => {
  const existingData = await database.rymAlbumData.findUnique({
    where: { albumId: album.id },
  });

  if (existingData) {
    logger.info("Skipping loading RYM data for album %s", album.name);
    return;
  }

  await albumDataFetchQueue.add(album);
};
