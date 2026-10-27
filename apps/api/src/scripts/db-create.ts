import { getConfig } from '../config/env';
import { ensureDatabase } from '../db/admin';

async function main(): Promise<void> {
  const config = getConfig();
  if (config.isProduction && !process.argv.includes('--allow-production')) {
    console.error('Refusing to create a database in production without --allow-production.');
    process.exit(1);
  }
  const created = await ensureDatabase(config);
  console.log(created ? `Created database "${config.db.database}".` : `Database "${config.db.database}" already exists.`);
}

main().catch((err: unknown) => {
  console.error('db:create failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
