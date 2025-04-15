/** @type {import('next').NextConfig} */
module.exports = {
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: 'http://0.0.0.0:5328/api/:path*'
    }
  ]
}