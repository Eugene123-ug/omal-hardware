import type { IncomingMessage, ServerResponse } from 'node:http';
import { getConfig } from '../apps/api/src/config/env';
import { createLogger } from '../apps/api/src/common/logger';
import { createDb } from '../apps/api/src/db/connection';
import { createApp } from '../apps/api/src/app';

let appInstance: any = null;

function getApp() {
  if (!appInstance) {
    const config = getConfig();
    const logger = createLogger(config);
    const db = createDb(config);
    appInstance = createApp({ config, logger, db });
  }
  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = getApp();
  return app(req, res);
}
