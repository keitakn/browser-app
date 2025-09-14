import { beforeAll } from "vitest";

beforeAll(async () => {
  // direnvで設定された環境変数を確認
  const requiredEnvVars = ["OPENAI_API_KEY"];
  const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}. Please ensure direnv is loaded.`,
    );
  }

  // サーバーが起動しているかを確認
  try {
    const response = await fetch("http://localhost:8080/healthz");
    if (!response.ok) {
      throw new Error(`Server health check failed: ${response.status}`);
    }
    console.log("✓ Server is running on port 8080");
  } catch (error) {
    throw new Error(
      `Server is not running on port 8080. Please start the server with 'npm run dev' before running tests. Error: ${error.message}`,
    );
  }
});
