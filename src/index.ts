import { database } from "./database";
import { logger } from "./logger";
import { launchBrowser, loadRymAlbumData } from "./rym";
import { fetchUserLibrary } from "./spotify/client";

// fetchUserLibrary().catch((error) => {
//   logger.error(error);
// });

// fetchAlbumData("Jay-Z", "Magna Carta... Holy Grail")
//   .then((data) => console.log(JSON.stringify(data, undefined, 2)))
//   .catch((error) => {
//     logger.error(error);
//   });

const getAlbums = () => database.album.findMany();

const wait = (s: number) =>
  new Promise((resolve) => setTimeout(resolve, s * 1000));

const program = async () => {
  await fetchUserLibrary();
  const { page } = await launchBrowser();
  const albums = await getAlbums();

  for (const album of albums) {
    try {
      await loadRymAlbumData(page, album.id);
    } catch (error) {
      logger.error(error);
    }
    //await wait(10);
  }
};

const run = async () => {
  const start = new Date();
  try {
    await program();
  } catch (error) {
    logger.error(error);
  } finally {
    const end = new Date();
    logger.info(`Finished in ${end.getTime() - start.getTime()}ms`);
  }
};

run().catch((error) => {
  logger.error(error);
});
