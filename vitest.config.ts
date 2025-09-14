import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 60000, // 各テストのタイムアウト60秒
    hookTimeout: 30000, // フックのタイムアウト30秒
    globals: true, // グローバルAPIを有効化
    environment: "node", // Node.js環境でテスト実行
    setupFiles: ["./tests/e2e/setup.ts"],
    pool: "threads", // スレッドプールで実行
    poolOptions: {
      threads: {
        singleThread: true, // シングルスレッドで実行
      },
    },
  },
});
