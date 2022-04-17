import { logger } from "./logger";
import { getChartRecommendations } from "./programs/get-chart-recommendations";
import { loadUserData } from "./programs/load-user-data";
import { processAlbumDataFetch } from "./programs/process-album-data-fetch";
import { startQueueDashboard } from "./programs/start-queue-dashboard";
import { sync } from "./programs/sync";

const run = async (program: () => Promise<void> | void) => {
  const start = new Date();
  try {
    await program();
    // eslint-disable-next-line no-process-exit, unicorn/no-process-exit
    //process.exit(0);
  } catch (error) {
    logger.error(error);
  } finally {
    const end = new Date();
    logger.info(`Finished in ${end.getTime() - start.getTime()}ms`);
  }
};

const commands = {
  sync,
  "start-queue-dashboard": startQueueDashboard,
  "process-album-data-fetch": processAlbumDataFetch,
  "get-chart-recommendations": getChartRecommendations,
};

const command = process.argv[2] as string | undefined;
if (!command) {
  throw new Error("No command specified");
}
if (!(command in commands)) {
  throw new Error(`Unknown command ${command}`);
}
void run(commands[command as keyof typeof commands]);
