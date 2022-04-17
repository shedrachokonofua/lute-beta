// eslint-disable node/no-extraneous-import
import { createBullBoard } from "@bull-board/api";
import { BullAdapter } from "@bull-board/api/bullAdapter";
import { ExpressAdapter } from "@bull-board/express";
import express from "express";
import { config } from "../config";
import { logger } from "../logger";

import { albumDataFetchQueue } from "../rym/album-data-fetch-queue";

const serverAdapter = new ExpressAdapter();

createBullBoard({
  serverAdapter,
  queues: [new BullAdapter(albumDataFetchQueue)],
});

const app = express();
app.use("/", serverAdapter.getRouter());

export const startQueueDashboard = (): void => {
  app.listen(config.queueDashboardPort, () => {
    logger.info(
      `Queue dashboard listening on port ${config.queueDashboardPort}`
    );
  });
};
