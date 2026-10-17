import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PoliVid",
    short_name: "PoliVid",
    description:
      "Turn any idea into a polished short video with animated scenes, charts, and captions.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0317",
    theme_color: "#1d0a3e",
    icons: [
      { src: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512" },
      { src: "/icon-mask.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
