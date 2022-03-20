import { database } from "./database";

export enum KVStoreKey {
  spotifyAccessToken = "spotifyAccessToken",
  spotifyRefreshToken = "spotifyRefreshToken",
  spotifyAccessTokenExpiration = "spotifyAccessTokenExpiration",
}

const defaultParser = <T>(x: string) => (x as unknown) as T;

export const retrieveValue = async <T = string>(
  key: KVStoreKey,
  parse: (value: string) => T = defaultParser
): Promise<T | undefined> => {
  const item = await database.kVStore.findUnique({
    where: { key },
  });

  if (!item?.value) return;

  return parse(item.value);
};

export const retrieveValueOrThrow = async <T = string>(
  key: KVStoreKey,
  parse: (value: string) => T = defaultParser
): Promise<T> => {
  const value = await retrieveValue(key, parse);
  if (!value) throw new Error(`No value found for key ${key}`);
  return value;
};

interface Stringable {
  toString(): string;
}

export const storeValue = async <T extends Stringable>(
  key: KVStoreKey,
  rawValue: T
): Promise<void> => {
  const value = rawValue.toString();

  await database.kVStore.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
};
