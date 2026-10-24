/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"]
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL || "http://127.0.0.1:4000"}/api/:path*`
      },
      {
        source: "/uploads/:path*",
        destination: `${process.env.API_URL || "http://127.0.0.1:4000"}/uploads/:path*`
      }
    ];
  }
};

export default nextConfig;
