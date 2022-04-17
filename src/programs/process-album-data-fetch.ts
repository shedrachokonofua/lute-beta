import puppeteer from "puppeteer-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { database } from "../database";
import { logger } from "../logger";
import { fetchAlbumData } from "../rym";
import { albumDataFetchQueue } from "../rym/album-data-fetch-queue";

export const processAlbumDataFetch = async (): Promise<void> => {
  await albumDataFetchQueue.process(
    async ({ data: album }): Promise<void> => {
      const browser = await puppeteer.use(stealth()).launch({
        headless: true,
      });
      const browserPage = await browser.newPage();

      try {
        const albumData = await fetchAlbumData(
          browserPage,
          album.name,
          album.artists[0].name
        );

        await database.rymAlbumData.upsert({
          where: { albumId: album.id },
          update: albumData,
          create: { ...albumData, albumId: album.id },
        });
        logger.info("Saved RYM album data", albumData);
      } finally {
        await browser.close();
      }
    }
  );
};
