import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Splitwisely",
    short_name: "Splitwisely",
    description: "Track shared expenses, balances and settle-ups for the group.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#18181b",
    categories: ["finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Expenses", short_name: "Expenses", url: "/#expenses", description: "Shared expenses" },
      { name: "Balances", short_name: "Balances", url: "/#balances", description: "Who owes whom" },
    ],
  };
}
