import * as fs from "fs/promises";

export const saveToFile = async (
  table: unknown,
  fileName: string
): Promise<void> => {
  const file = await fs.open(fileName + ".json", "w");
  await file.write(JSON.stringify(table, undefined, 2));
  await file.close();
};

export const getScriptArguments = (): string[] => process.argv.slice(2);
