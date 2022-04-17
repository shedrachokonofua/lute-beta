import { database } from "../database";
import { getScriptArguments, saveToFile } from "./common";

const mostCommonDescriptorsByGenre = async (
  genre: string
): Promise<
  {
    genre: string;
    count: number;
  }[]
> => {
  if (!genre) {
    throw new Error("No genre specified");
  }

  return database.$queryRaw`
    SELECT unnest("primaryGenres") as genre, COUNT(*) as count
    FROM "RymAlbumData"
    WHERE '${genre}' = ANY("primaryGenres")
    GROUP BY 1
    ORDER BY 2 DESC
  `;
};

const [
  genre,
  fileName = "most-common-descriptors-by-genre",
] = getScriptArguments();

mostCommonDescriptorsByGenre(genre)
  .then((output) => saveToFile(output, fileName))
  .catch(console.error);
