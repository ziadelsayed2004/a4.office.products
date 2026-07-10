module.exports = {
  apps: [
    {
      name: "a4-pos-server",
      script: "./server/src/server.js",
      // Note: SQLite works best in 'fork' mode with a single instance to prevent file lock contention.
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "500M",
      env_production: {
        NODE_ENV: "production",
        PORT: 5000
      }
    }
  ]
};
