import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Local development backend
      {
        protocol: "http",
        hostname: "localhost",
        port: "5000",
        pathname: "/uploads/**",
      },
      // Hostinger backend (update hostname to your actual Hostinger domain)
      {
        protocol: "https",
        hostname: "*.hostingersite.com",
        pathname: "/uploads/**",
      },
      // Render.com (legacy / staging)
      {
        protocol: "https",
        hostname: "interior-firm-pro2.onrender.com",
        pathname: "/**",
      },
      // Any custom domain — add your production backend domain here
      // { protocol: "https", hostname: "api.yourdomain.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
