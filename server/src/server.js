import config from './config/index.js';
import app from './app.js';
import { runMigrations } from './db/migrate.js';

const PORT = config.port;

async function startServer() {
  try {
    // Execute database migrations
    await runMigrations();

    app.listen(PORT, () => {
      console.log(`========================================`);
      console.log(` A4 POS Backend running on port ${PORT}`);
      console.log(` Timezone: Africa/Cairo`);
      console.log(` Database: SQLite`);
      console.log(`========================================`);
    });
  } catch (error) {
    console.error('FATAL: Failed to initialize application server:', error.message);
    process.exit(1);
  }
}

startServer();
