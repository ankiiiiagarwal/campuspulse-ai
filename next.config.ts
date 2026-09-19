import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
};

export default (phase: string): NextConfig => ({
  ...nextConfig,
  distDir: phase === PHASE_DEVELOPMENT_SERVER
    ? (process.env.CAMPUSPULSE_DEMO === "1" ? ".next-demo" : ".next-dev")
    : ".next",
});
