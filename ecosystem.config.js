module.exports = {
  apps: [
    {
      name: 'assetra-web',
      cwd: '/home/ec2-user/Assetra/apps/web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '500M',
      instances: 1,
    },
    {
      name: 'assetra-api',
      cwd: '/home/ec2-user/Assetra/apps/api',
      script: 'dist/index.js',
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
