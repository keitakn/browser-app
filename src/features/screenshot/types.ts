export interface ScreenshotMetadata {
  requestId: string;
  timestamp: string;
  handlerName: string;
  status: "success" | "error";
}

export interface SaveScreenshotResult {
  url: string;
  key: string;
}
