module.exports = {
  apps: [
    {
      name: 'a4-pos-server',
      cwd: __dirname,
      script: './server/src/server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      time: true,
      max_memory_restart: '500M',
      out_file: './logs/server-out.log',
      error_file: './logs/server-error.log',
      merge_logs: true,
      kill_timeout: 10000,
      listen_timeout: 10000,
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        HOST: '127.0.0.1',
      },
    },
  ],
};
