import { database } from "../database";
import { saveToFile } from "../reports/common";
import { launchBrowser, fetchAlbumChart, RYMChartAlbum } from "../rym";

const NOVELTY_FACTOR = 0.25; // Percentile assigned to genres/descriptors not in user data

interface RecommendationItem {
  chartAlbum: RYMChartAlbum;
  ratingPercentile: number;
  ratingCountPercentile: number;
  averagePrimaryGenrePercentile: number;
  averageSecondaryGenrePercentile: number;
  averagePrimaryCrossGenrePercentile: number;
  averageSecondaryCrossGenrePercentile: number;
  averageDescriptorPercentile: number;
  averagePercentile: number;
}

const getPercentileByIndex = (index: number, listSize: number): number =>
  (index + 1) / listSize;

const getSortedAscRatings = async (): Promise<number[]> => {
  const records = await database.rymAlbumData.findMany({
    select: {
      rating: true,
    },
    orderBy: {
      rating: "asc",
    },
  });
  return records.map((record) => record.rating);
};

const getSortedAscRatingCounts = async (): Promise<number[]> => {
  const records = await database.rymAlbumData.findMany({
    select: {
      ratingCount: true,
    },
    orderBy: {
      ratingCount: "asc",
    },
  });
  return records.map((record) => record.ratingCount);
};

const getSortedAscPrimaryGenres = async (): Promise<
  {
    genre: string;
    count: number;
  }[]
> =>
  database.$queryRaw`
    SELECT unnest("primaryGenres") as genre, COUNT(*) as count
    FROM "RymAlbumData"
    GROUP BY 1
    ORDER BY 2 ASC
  `;

const getSortedAscSecondaryGenres = async (): Promise<
  {
    genre: string;
    count: number;
  }[]
> =>
  database.$queryRaw`
    SELECT unnest("secondaryGenres") as genre, COUNT(*) as count
    FROM "RymAlbumData"
    GROUP BY 1
    ORDER BY 2 ASC
  `;

const getSortedAscDescriptors = async (): Promise<
  {
    descriptor: string;
    count: number;
  }[]
> =>
  database.$queryRaw`
    SELECT unnest("descriptors") as descriptor, COUNT(*) as count
    FROM "RymAlbumData"
    GROUP BY 1
    ORDER BY 2 ASC
  `;

const sortAsc = (a: number, b: number): number => a - b;

const getRatingPercentile = (rating: number, ratings: number[]): number => {
  const ratingIndex = ratings.concat(rating).sort(sortAsc).indexOf(rating);
  return getPercentileByIndex(ratingIndex, ratings.length + 1);
};

const getRatingCountPercentile = (
  ratingCount: number,
  ratingCounts: number[]
): number => {
  const index = ratingCounts
    .concat(ratingCount)
    .sort(sortAsc)
    .indexOf(ratingCount);
  return getPercentileByIndex(index, ratingCounts.length + 1);
};

const getTagPercentile = <Tag extends string>(
  tag: Tag,
  value: string,
  items: ({ [key in Tag]: string } & { count: number })[]
): number => {
  const index = items.findIndex((item) => item[tag] === value);
  if (index === -1) {
    return NOVELTY_FACTOR;
  }
  return getPercentileByIndex(index, items.length);
};

const getGenrePercentile = (
  genre: string,
  genres: { genre: string; count: number }[]
): number => getTagPercentile("genre", genre, genres);

const getDescriptorPercentile = (
  descriptor: string,
  descriptors: { descriptor: string; count: number }[]
): number => getTagPercentile("descriptor", descriptor, descriptors);

const getAverage = (items: number[]): number =>
  // eslint-disable-next-line unicorn/no-reduce
  items.reduce((accumulator, current) => accumulator + current, 0) /
  items.length;

const pick = <T>(items: T[], count: number): T[] =>
  items.slice(0, Math.min(items.length, count));

const repeat = <T>(item: T, count: number): T[] =>
  Array.from({ length: count }, () => item);

const wait = (s: number) =>
  new Promise((resolve) => setTimeout(resolve, s * 1000));

const getChart = async (): Promise<RYMChartAlbum[]> => {
  const { page: browserPage } = await launchBrowser();
  const allAlbums = [];

  for (let page = 1; page <= 10; page++) {
    const chart = await fetchAlbumChart(browserPage, "2010s", page, [
      "hip-hop",
    ]);
    await wait(2);
    allAlbums.push(...chart);
  }

  await browserPage.close();

  return allAlbums;
};

export const getChartRecommendations = async (): Promise<void> => {
  const [
    chartAlbums,
    ratings,
    ratingCounts,
    primaryGenres,
    secondaryGenres,
    descriptors,
  ] = await Promise.all([
    getChart(),
    getSortedAscRatings(),
    getSortedAscRatingCounts(),
    getSortedAscPrimaryGenres(),
    getSortedAscSecondaryGenres(),
    getSortedAscDescriptors(),
  ]);

  const recommendations = chartAlbums.map<RecommendationItem>((chartAlbum) => {
    const ratingPercentile = getRatingPercentile(chartAlbum.rating, ratings);
    const ratingCountPercentile = getRatingCountPercentile(
      chartAlbum.ratingCount,
      ratingCounts
    );
    const averagePrimaryGenrePercentile = getAverage(
      chartAlbum.primaryGenres.map((genre) =>
        getGenrePercentile(genre, primaryGenres)
      )
    );
    const averageSecondaryGenrePercentile = getAverage(
      chartAlbum.secondaryGenres.map((genre) =>
        getGenrePercentile(genre, secondaryGenres)
      )
    );
    const averagePrimaryCrossGenrePercentile = getAverage(
      chartAlbum.primaryGenres.map((genre) =>
        getGenrePercentile(genre, secondaryGenres)
      )
    );
    const averageSecondaryCrossGenrePercentile = getAverage(
      chartAlbum.secondaryGenres.map((genre) =>
        getGenrePercentile(genre, primaryGenres)
      )
    );

    const averageDescriptorPercentile = getAverage(
      chartAlbum.descriptors.map((descriptor) =>
        getDescriptorPercentile(descriptor, descriptors)
      )
    );

    const averagePercentile = getAverage([
      ...repeat(ratingPercentile, 10),
      ...repeat(ratingCountPercentile, 5),
      ...repeat(averagePrimaryGenrePercentile, 45),
      ...repeat(averageSecondaryGenrePercentile, 30),
      ...repeat(averagePrimaryCrossGenrePercentile, 20),
      ...repeat(averageSecondaryCrossGenrePercentile, 15),
      ...repeat(averageDescriptorPercentile, 90),
    ]);

    return {
      chartAlbum,
      ratingPercentile,
      ratingCountPercentile,
      averagePrimaryGenrePercentile,
      averageSecondaryGenrePercentile,
      averagePrimaryCrossGenrePercentile,
      averageSecondaryCrossGenrePercentile,
      averageDescriptorPercentile,
      averagePercentile,
    };
  });

  const sortedRecommendations = recommendations.sort(
    (a, b) => b.averagePercentile - a.averagePercentile
  );

  await saveToFile(pick(sortedRecommendations, 10), "chart-recommendations");
};
