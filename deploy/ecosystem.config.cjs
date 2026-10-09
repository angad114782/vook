// pm2 process file for the Vook API. The deploy workflow uploads it next to the API and starts or restarts it for you.
// Secrets are NOT here: they are read from /etc/vook/server.env, which exists only on the VPS.
module.exports = {
  apps: [
    {
      name: 'vook-api',
      script: 'dist/index.js',
      cwd: '/var/www/influencersfeed.com/server',
      node_args: '--env-file=/etc/vook/server.env',
      // One copy only: live notifications keep their connections in memory, so a second copy would split them.
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '700M',
      // The API finishes open requests on shutdown (up to 10 seconds); give it a little longer before pm2 forces it.
      kill_timeout: 12000,
      time: true,
    },
  ],
};
