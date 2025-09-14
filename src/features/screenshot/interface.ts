import type { ScreenshotMetadata, SaveScreenshotResult } from "./types.js";

export type SaveScreenshot = (
  buffer: Buffer,
  metadata: ScreenshotMetadata,
) => Promise<SaveScreenshotResult>;
