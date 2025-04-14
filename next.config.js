/** @type {import('next').NextConfig} */
module.exports = {
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: `http://localhost:${process.env.FLASK_PORT || 5328}/api/:path*`,
    },
  ],
};