module.exports = {
  apps: [
    {
      name: "news-anime-monitor",
      script: "./src/api/index.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3001,
      },
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm Z",
    },
  ],
};
