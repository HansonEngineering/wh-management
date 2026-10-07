import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WH Management",
    short_name: "WH Mgmt",
    description: "Sistem pengurusan hotel: stok, housekeeping, maintenance dan staff",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#1a1d23",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
