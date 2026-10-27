import { getConfig } from '../config/env';
import { createDb } from '../db/connection';

type Command = 'latest' | 'rollback' | 'status';

async function main(): Promise<void> {
  const command = (process.argv[2] ?? 'status') as Command;
  const config = getConfig();
  const db = createDb(config);
  try {
    if (command === 'latest') {
      const [batch, files] = await db.migrate.latest();
      console.log(files.length ? `Batch ${batch}: applied ${files.length} migration(s):\n - ${files.join('\n - ')}` : 'Database is already up to date.');
    } else if (command === 'rollback') {
      if (config.isProduction && !process.argv.includes('--allow-production')) {
        throw new Error('Refusing to roll back in production without --allow-production.');
      }
      const [batch, files] = await db.migrate.rollback();
      console.log(files.length ? `Rolled back batch ${batch}:\n - ${files.join('\n - ')}` : 'Nothing to roll back.');
    } else if (command === 'status') {
      const [completed, pending] = (await db.migrate.list()) as [{ name: string }[], { file: string }[]];
      console.log(`Database: ${config.db.database}`);
      console.log(`Applied (${completed.length}):`);
      completed.forEach((m) => console.log(`  [x] ${m.name}`));
      console.log(`Pending (${pending.length}):`);
      pending.forEach((m) => console.log(`  [ ] ${m.file}`));
    } else {
      throw new Error(`Unknown command "${command}". Use: latest | rollback | status`);
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err: unknown) => {
  console.error('migrate failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
