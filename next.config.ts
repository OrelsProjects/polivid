import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: "/api/uploads/**" },
      { pathname: "/api/videos/**" },
      { pathname: "/api/editor/assets/**" },
      { pathname: "/api/productions/assets/**" },
      { pathname: "/presets/**", search: "" },
      { pathname: "/brand/**", search: "" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
  serverExternalPackages: ["@remotion/renderer", "@remotion/bundler"],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
