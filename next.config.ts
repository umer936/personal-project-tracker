import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a fully static site in ./out (plain HTML/CSS/JS) that can be
  // uploaded to any web host — no Node server, no Docker required.
  // All data is stored client-side in the browser (localStorage).
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
