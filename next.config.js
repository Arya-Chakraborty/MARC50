/** @type {import('next').NextConfig} */
module.exports = {
  rewrites: async () => [
    {
      source: '/api/:path*',
      // Explicitly use IPv4 loopback address
      destination: `http://127.0.0.1:${process.env.FLASK_PORT || 5328}/api/:path*`, 
    },
  ],
};