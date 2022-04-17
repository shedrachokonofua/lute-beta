import { logger } from "../logger";
import { database } from "../database";
import { launchBrowser, loadRymAlbumData } from "../rym";
import { loadUserLibrary } from "../spotify/client";

const wait = (s: number) =>
  new Promise((resolve) => setTimeout(resolve, s * 1000));

export const loadUserData = async (): Promise<void> => {
  await loadUserLibrary();
  const { page } = await launchBrowser();
  const albums = await database.album.findMany();

  for (const album of albums) {
    try {
      await loadRymAlbumData(page, album.id);
    } catch (error) {
      logger.error(error);
    }
    await wait(10);
  }
};
