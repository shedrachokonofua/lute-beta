import { logger } from "../logger";
import { database } from "../database";
import { pushToAlbumDataFetchQueue } from "../rym/album-data-fetch-queue";
import { loadUserLibrary } from "../spotify/client";

export const sync = async (): Promise<void> => {
  await loadUserLibrary();
  logger.info("User spotify library loaded");
  const albums = await database.album.findMany({
    include: { artists: true },
  });
  logger.info("%d albums loaded into memory", albums.length);
  await Promise.all(
    albums.map(async (album) => {
      await pushToAlbumDataFetchQueue(album);
      logger.info("Pushed to album data fetch queue", album);
    })
  );
};
