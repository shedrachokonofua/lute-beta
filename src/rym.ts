import axios from "axios";
import XRay from "x-ray";
import { database } from "./database";
import puppeteer from "puppeteer-extra";
import { Browser, Page } from "puppeteer";
import stealth from "puppeteer-extra-plugin-stealth";
import { logger } from "./logger";
import { isBefore, subDays } from "date-fns";

const xray = XRay({
  filters: {
    trim: (value: string) => value.trim(),
    toReleaseType: (value: string) => {
      const type = value.toLowerCase();
      return type === "ep" ? "album" : type;
    },
    toNumber: (value: string) => Number(value.replace(/,/g, "")) || 0,
    dropTrailingComma: (value: string) => value.replace(/,\s*$/, "").trim(),
    dropTrailingDot: (value: string) => value.replace(/\.\s*$/, "").trim(),
  },
});

interface SearchResult {
  releaseName: string;
  releaseHref: string;
}

const getRymUrl = (path: string, parameters: Record<string, string> = {}) => {
  const urlParameters = new URLSearchParams(parameters);
  return `https://www.rateyourmusic.com/${path}?${urlParameters.toString()}`;
};

const getPageHtml = async (browserPage: Page, url: string) => {
  await browserPage.goto(url);
  return await browserPage.content();
};

const search = async (
  browserPage: Page,
  query: string
): Promise<SearchResult> => {
  const data = await getPageHtml(
    browserPage,
    getRymUrl("search", {
      searchterm: query,
      searchtype: "l",
    })
  );
  const results = (await xray(data, ".infobox", [
    { releaseName: "a.searchpage", releaseHref: "a.searchpage@href" },
  ])) as SearchResult[];

  if (results.length === 0) {
    throw new Error("No results found");
  }

  return results[0];
};

interface RYMAlbumData {
  rating: number;
  ratingCount: number;
  primaryGenres: string[];
  secondaryGenres: string[];
  descriptors: string[];
}

const metaSelector = (name: string) => `meta[itemprop=${name}]@content`;

export const fetchAlbumData = async (
  browserPage: Page,
  albumName: string,
  artistName: string
): Promise<RYMAlbumData> => {
  const result = await search(browserPage, `${artistName} ${albumName}`);
  const html = await getPageHtml(browserPage, getRymUrl(result.releaseHref));

  const albumData = (await xray(html, ".release_page", {
    rating: metaSelector("ratingValue") + "| toNumber",
    ratingCount: metaSelector("ratingCount") + "| toNumber",
    primaryGenres: xray(".release_pri_genres > .genre", ["@text"]),
    secondaryGenres: xray(".release_sec_genres > .genre", ["@text"]),
    descriptors: xray(".release_descriptors > td > meta", ["@content | trim"]),
  })) as RYMAlbumData | undefined;

  if (!albumData) {
    throw new Error("Couldn't find album data");
  }

  return albumData;
};

export interface RYMChartAlbum {
  name: string;
  artistNames: string[];
  rank: number;
  rating: number;
  ratingCount: number;
  primaryGenres: string[];
  secondaryGenres: string[];
  descriptors: string[];
}

export const fetchAlbumChart = async (
  browserPage: Page,
  year = "2022",
  page = 1,
  excludeGenres: string[] = []
): Promise<RYMChartAlbum[]> => {
  const filters = excludeGenres
    ? `/g:${excludeGenres.map((g) => `-${g}`).join(",")}`
    : "";
  const chartUrl = getRymUrl(`charts/top/album/${year}${filters}/${page}/`);
  const html = await getPageHtml(browserPage, chartUrl);

  const albums = (await xray(html, ".chart_item_release", [
    {
      name: ".topcharts_item_title",
      artistNames: xray(".topcharts_item_artist", ["a | trim"]),
      rank: ".topcharts_position | dropTrailingDot | toNumber",
      rating: ".topcharts_avg_rating_stat | toNumber",
      ratingCount: ".topcharts_ratings_stat | toNumber",
      primaryGenres: xray(".topcharts_item_genres_container", ["a"]),
      secondaryGenres: xray(".topcharts_item_secondarygenres_container", ["a"]),
      descriptors: xray(".topcharts_item_descriptors_container", [
        "span | dropTrailingComma",
      ]),
    },
  ])) as RYMChartAlbum[] | undefined;

  if (!albums) {
    throw new Error("Couldn't find albums");
  }

  return albums;
};

const isOlderThan1Day = (date: Date) =>
  isBefore(new Date(date), subDays(new Date(), 1));

export const loadRymAlbumData = async (
  browserPage: Page,
  albumId: string
): Promise<void> => {
  const album = await database.album.findUnique({
    where: { id: albumId },
    include: { artists: true },
  });
  if (!album) {
    throw new Error("Couldn't find album");
  }

  const existingData = await database.rymAlbumData.findUnique({
    where: { albumId },
  });

  if (existingData && !isOlderThan1Day(existingData.updatedAt)) {
    logger.info("Skipping loading RYM data for album %s", album.name);
    return;
  }

  const albumData = await fetchAlbumData(
    browserPage,
    album.name,
    album.artists[0].name
  );

  await database.rymAlbumData.upsert({
    where: { albumId },
    update: albumData,
    create: { ...albumData, albumId },
  });
  logger.info("Saved RYM album data", albumData);
};

export const launchBrowser = async () => {
  const browser = await puppeteer.use(stealth()).launch({
    headless: true,
  });
  return {
    page: await browser.newPage(),
    close: async () => {
      await browser.close();
    },
  };
};
