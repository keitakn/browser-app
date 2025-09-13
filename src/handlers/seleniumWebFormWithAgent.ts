// src/handlers/seleniumWebForm.ts
import type { Context } from "hono";
import { Stagehand, type ConstructorParams, type LogLine } from "@browserbasehq/stagehand";
import type Browserbase from "@browserbasehq/sdk";

/** リクエストボディ */
interface SeleniumWebFormRequestBody {
  text: string;
  password?: string;
  textarea?: string;
  select?: "One" | "Two" | "Three";
  checkDefaultCheckbox?: boolean;
  radio?: "default" | "checked";
  color?: `#${string}`;
  date?: `${number}-${number}-${number}`; // YYYY-MM-DD
  range?: number;
  waitAfterSubmitMs?: number;
}

/** LLMクライアントのオプション */
interface ClientOptions {
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}
/** ローカル起動時のブラウザオプション */
interface LocalBrowserLaunchOptions {
  headless?: boolean;
  devtools?: boolean;
}

/** API レスポンスに載せる公開ログ（LLM詳細はレダクト） */
type PublicCategory = "browser" | "action" | "llm" | "error" | "stagehand" | "cache";
interface PublicLogLine {
  category: PublicCategory;
  message: string;
  /** undefined を許容しないので必ず文字列にする（coalesce） */
  timestamp: string;
  auxiliary?: {
    url?: string;
    /** 実装差があるので unknown として安全に保持 */
    executionTime?: unknown;
  };
}

export async function seleniumWebFormWithAgentHandler(c: Context) {
  const body = (await c.req.json()) as SeleniumWebFormRequestBody;
  if (!body?.text) return c.json({ ok: false, error: "text is required" }, 400);

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) return c.json({ ok: false, error: "OPENAI_API_KEY is missing" }, 500);

  const isLocal = (process.env.STAGEHAND_ENV ?? "LOCAL").toUpperCase() === "LOCAL";
  const modelClientOptions: ClientOptions = { apiKey: openaiApiKey };

  // ===== 構造化ログ収集（aux が空ならキーごと省略 / timestamp は必ず string 化）=====
  const collectedLogs: PublicLogLine[] = [];
  const normalizeCategory = (cat: string): PublicCategory =>
    cat === "browser" ||
    cat === "action" ||
    cat === "llm" ||
    cat === "error" ||
    cat === "stagehand" ||
    cat === "cache"
      ? cat
      : "stagehand";

  const logger = (line: LogLine): void => {
    // LLM の詳細は出さない
    if (line.category === "llm") {
      collectedLogs.push({
        category: "llm",
        message: "[LLM interaction redacted]",
        timestamp: line.timestamp ?? new Date().toISOString(),
      });
      return;
    }

    const auxiliary: PublicLogLine["auxiliary"] = {};
    if (line.auxiliary?.url) auxiliary.url = String(line.auxiliary.url);
    if (line.auxiliary?.executionTime) auxiliary.executionTime = line.auxiliary.executionTime; // unknown として保持

    const base: Omit<PublicLogLine, "auxiliary"> = {
      category: normalizeCategory(line.category as string),
      message: line.message,
      timestamp: line.timestamp ?? new Date().toISOString(), // ★ string に強制
    };

    if (Object.keys(auxiliary).length > 0) {
      collectedLogs.push({ ...base, auxiliary });
    } else {
      collectedLogs.push(base);
    }
  };

  // CUA 向け viewport は 1024x768 が最適（公式推奨） :contentReference[oaicite:1]{index=1}
  const cuaViewport = { width: 1024, height: 768 };

  // --- コンストラクタは公式の ConstructorParams で定義 ---
  const ctor: ConstructorParams = (() => {
    if (isLocal) {
      return {
        env: "LOCAL",
        modelName: "openai/gpt-5",
        modelClientOptions,
        localBrowserLaunchOptions: {
          headless: false,
          devtools: true,
        } as LocalBrowserLaunchOptions,
        verbose: 2,
        logger,
        logInferenceToFile: true, // ローカルのみ
      };
    } else {
      const projectId = process.env.BROWSERBASE_PROJECT_ID;
      if (!projectId) {
        throw new Error("BROWSERBASE_PROJECT_ID is required for BROWSERBASE environment");
      }
      const bbKey = process.env.BROWSERBASE_API_KEY;
      return {
        env: "BROWSERBASE",
        modelName: "openai/gpt-5",
        modelClientOptions,
        projectId,
        browserbaseSessionCreateParams: {
          projectId,
          browserSettings: {
            viewport: cuaViewport,
            blockAds: true,
          },
        } as Browserbase.SessionCreateParams,
        ...(bbKey ? { apiKey: bbKey } : {}),
        verbose: 2,
        logger,
      };
    }
  })();

  const sh = new Stagehand(ctor);
  await sh.init();

  const page = sh.page;
  if (isLocal && page.setViewportSize) {
    await page.setViewportSize(cuaViewport);
  }

  await page.goto("https://www.selenium.dev/selenium/web/web-form.html");

  // ===== OpenAI Computer Use Agent で操作（computer-use-preview）=====
  const agent = sh.agent({
    provider: "openai",
    model: "computer-use-preview",
    options: { apiKey: openaiApiKey },
  });

  const instruction = `On the current page (Selenium Web Form), fill and submit the form with these values:
  - "Text input": ${JSON.stringify(body.text)}
  - "Password": ${JSON.stringify(body.password ?? "")}
  - "Textarea": ${JSON.stringify(body.textarea ?? "")}
  - "Dropdown (select)": ${JSON.stringify(body.select ?? "One")}
  - "Default checkbox": ${body.checkDefaultCheckbox ? "checked" : "unchecked"}
  - "Radio": ${body.radio === "checked" ? "Checked radio" : "Default radio"}
  - "Color picker": ${JSON.stringify(body.color ?? "")}
  - "Date picker": ${JSON.stringify(body.date ?? "")}
  - "Example range": ${JSON.stringify(body.range ?? "")}
  After filling all fields, click the "Submit" button. If a dialog/picker opens, set the value and close it.`;

  const agentResult = await agent.execute({
    instruction,
    maxSteps: 60,
    waitBetweenActions: 400,
    autoScreenshot: true,
  }); // usage / actions が含まれる。:contentReference[oaicite:2]{index=2}

  // === サーバーログに actions を出力（PIIに注意） ===
  try {
    console.info("[agent.actions]", JSON.stringify(agentResult.actions ?? [], null, 2));
  } catch {
    console.info(
      "[agent.actions] (non-serializable)",
      Array.isArray(agentResult.actions) ? agentResult.actions.length : 0,
    );
  }

  // ===== 完了文言とURL検証 =====
  await page.waitForURL(/submitted-form\.html/i, { timeout: 15_000 });
  await page.getByText("Form submitted").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("Received!").waitFor({ state: "visible", timeout: 10_000 });

  const currentUrl = page.url();
  const params = new URL(currentUrl).searchParams;

  const mismatches: string[] = [];
  const expectEq = (k: string, exp?: string) => {
    if (exp === undefined) return;
    const act = params.get(k);
    if (act !== exp) mismatches.push(`${k}: expected "${exp}", got "${act}"`);
  };

  const selectValueMap = { One: "1", Two: "2", Three: "3" } as const;
  const expectedSelect = body.select ? selectValueMap[body.select] : undefined;

  expectEq("my-text", body.text);
  expectEq("my-password", body.password);
  expectEq("my-textarea", body.textarea);
  expectEq("my-select", expectedSelect);
  expectEq("my-colors", body.color);
  expectEq("my-date", body.date);
  if (body.range !== undefined) expectEq("my-range", String(body.range));

  if (body.checkDefaultCheckbox !== undefined) {
    const count = params.getAll("my-check").length;
    const expectedCount = body.checkDefaultCheckbox ? 2 : 1;
    if (count !== expectedCount)
      mismatches.push(`my-check count: expected ${expectedCount}, got ${count}`);
  }

  await page.waitForTimeout(body.waitAfterSubmitMs ?? 2_000);

  const title = await page.title();
  await sh.close();

  const usage = agentResult.usage ?? null;
  const actions = agentResult.actions ?? [];

  return c.json(
    {
      ok: mismatches.length === 0,
      title,
      url: currentUrl,
      assertions: { urlValuesOk: mismatches.length === 0, mismatches },
      agent: {
        success: agentResult.success,
        message: agentResult.message,
        completed: agentResult.completed,
        usage, // { input_tokens, output_tokens, inference_time_ms }
        actions, // 実行アクション
        logs: collectedLogs,
      },
    },
    200,
  );
}
