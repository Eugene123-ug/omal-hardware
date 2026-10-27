const knex = require('knex');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.development' });

async function getTables() {
  const db = knex({ client: 'pg', connection: process.env.DATABASE_URL, pool: { min: 1, max: 2 } });
  try {
    const res = await db.raw("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename;");
    console.log(JSON.stringify(res.rows.map(r => r.tablename)));
  } finally {
    await db.destroy();
  }
}
getTables();
