module.exports = {
  apps: [
    {
      name: 'assetra-web',
      cwd: '/home/ec2-user/Assetra/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3005',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
      },
      max_memory_restart: '500M',
      instances: 1,
    },
    {
      name: 'assetra-api',
      cwd: '/home/ec2-user/Assetra/apps/api',
      script: 'dist/index.js',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3333,
        HOST: '0.0.0.0',
      },
      max_memory_restart: '300M',
      instances: 1,
    },
  ],
};
