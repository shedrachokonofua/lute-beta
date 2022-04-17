import { database } from "../database";
import * as fs from "fs/promises";

interface Output {
  [descriptor: string]: {
    [descriptor: string]: number;
  };
}

const getMostCommonPairs = async (): Promise<Output> => {
  const records = await database.rymAlbumData.findMany({
    select: {
      descriptors: true,
    },
    where: {
      primaryGenres: {
        has: "Art Pop",
      },
    },
  });

  // eslint-disable-next-line unicorn/no-reduce
  return records.reduce<Output>((table, { descriptors }) => {
    for (const descriptor of descriptors) {
      if (!table[descriptor]) {
        table[descriptor] = {};
      }
      for (const otherDescriptor of descriptors) {
        if (descriptor !== otherDescriptor) {
          table[descriptor][otherDescriptor] =
            (table[descriptor][otherDescriptor] || 0) + 1;
        }
      }
    }
    return table;
  }, {});
};

const saveToFile = async (table: Output, fileName: string) => {
  const file = await fs.open(fileName, "w");
  await file.write(JSON.stringify(table, undefined, 2));
  await file.close();
};

const fileName = process.argv[2] || "most-common-pairs.json";
getMostCommonPairs()
  .then((output) => saveToFile(output, fileName))
  .catch(console.error);
