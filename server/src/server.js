import config from './config/index.js';
import app from './app.js';
import db from './db/index.js';
import { runMigrations } from './db/migrate.js';

let httpServer;
let shutdownPromise;

async function closeHttpServer() {
  if (!httpServer?.listening) return;
  await new Promise((resolve, reject) => {
    httpServer.close((error) => {
      if (error) reject(error);
      else resolve();
    });
    httpServer.closeIdleConnections?.();
  });
}

async function shutdown(signal, exitCode = 0) {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    console.log(`Received ${signal}; shutting down gracefully.`);
    const forcedExit = setTimeout(() => {
      console.error(`Graceful shutdown exceeded ${config.shutdownTimeoutMs}ms.`);
      process.exit(1);
    }, config.shutdownTimeoutMs);
    forcedExit.unref();

    try {
      await closeHttpServer();
      await db.close();
      process.exitCode = exitCode;
      console.log('HTTP server and database connection closed.');
    } catch (error) {
      process.exitCode = 1;
      console.error(`Graceful shutdown failed: ${error.message}`);
    } finally {
      clearTimeout(forcedExit);
    }
  })();

  return shutdownPromise;
}

async function startServer() {
  try {
    await runMigrations();
    await new Promise((resolve, reject) => {
      httpServer = app.listen(config.port, resolve);
      httpServer.once('error', reject);
    });

    console.log('========================================');
    console.log(` A4 POS Backend running on port ${config.port}`);
    console.log(` Environment: ${config.env}`);
    console.log(` Timezone: ${config.timezone}`);
    console.log(' Database: SQLite');
    console.log('========================================');
  } catch (error) {
    console.error('FATAL: Failed to initialize application server:', error.message);
    await shutdown('startup failure', 1);
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

await startServer();
