// src/handlers/seleniumWebForm.ts
import type { Context } from "hono";
import { Stagehand } from "@browserbasehq/stagehand";
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
/** Stagehand 構成（LOCAL） */
interface StagehandLocalConstructorOptions {
  env: "LOCAL";
  modelName?: string;
  modelClientOptions?: ClientOptions;
  localBrowserLaunchOptions?: LocalBrowserLaunchOptions;
}
/** Stagehand 構成（BROWSERBASE） */
interface StagehandBrowserbaseConstructorOptions {
  env: "BROWSERBASE";
  modelName?: string;
  modelClientOptions?: ClientOptions;
  apiKey?: string;
  projectId?: string;
  browserbaseSessionCreateParams: Browserbase.SessionCreateParams; // projectId 必須
  browserbaseSessionID?: string;
}
type StagehandConstructorOptions =
  | StagehandLocalConstructorOptions
  | StagehandBrowserbaseConstructorOptions;

/** 公式 Selenium Web Form を自動入力→送信→検証 */
export async function seleniumWebFormHandler(c: Context) {
  const body = (await c.req.json()) as SeleniumWebFormRequestBody;
  if (!body?.text) return c.json({ ok: false, error: "text is required" }, 400);

  // LLM キー必須
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return c.json({ ok: false, error: "OPENAI_API_KEY is missing" }, 500);
  }

  const isLocal = (process.env.STAGEHAND_ENV ?? "LOCAL").toUpperCase() === "LOCAL";
  const modelClientOptions: ClientOptions = { apiKey: openaiApiKey };

  let ctor: StagehandConstructorOptions;
  if (isLocal) {
    ctor = {
      env: "LOCAL",
      modelName: "openai/gpt-5",
      modelClientOptions,
      localBrowserLaunchOptions: { headless: false, devtools: true },
    };
  } else {
    const projectId = process.env.BROWSERBASE_PROJECT_ID!;
    const bbKey = process.env.BROWSERBASE_API_KEY;
    ctor = {
      env: "BROWSERBASE",
      modelName: "openai/gpt-5",
      modelClientOptions,
      projectId,
      browserbaseSessionCreateParams: {
        projectId,
        browserSettings: {
          viewport: { width: 1920, height: 1080 }, // Browserbase対応サイズ
          blockAds: true,
        },
      },
      ...(bbKey ? { apiKey: bbKey } : {}),
    };
  }

  const sh = new Stagehand(ctor);
  await sh.init();

  const page = sh.page;

  // ローカルはここで明示的に 1920x1080 に（Browserbase は上で指定済み）
  if (isLocal && page.setViewportSize) {
    await page.setViewportSize({ width: 1920, height: 1080 });
  }

  // 公式デモフォーム
  await page.goto("https://www.selenium.dev/selenium/web/web-form.html"); // フィールド一覧あり。:contentReference[oaicite:1]{index=1}

  // ===== 入力（決定的操作）=====
  // text / password / textarea
  await page.locator('input[name="my-text"]').fill(body.text);
  if (body.password !== undefined) {
    await page.locator('input[name="my-password"]').fill(body.password);
  }
  if (body.textarea !== undefined) {
    await page.locator('textarea[name="my-textarea"]').fill(body.textarea);
  }

  // select（ラベル指定で選択）
  if (body.select) {
    await page.locator('select[name="my-select"]').selectOption({ label: body.select });
  }

  // checkbox（Default のみトグル）
  if (typeof body.checkDefaultCheckbox === "boolean") {
    const defaultCk = page.getByLabel("Default checkbox");
    const now = await defaultCk.isChecked();
    if (now !== body.checkDefaultCheckbox) {
      body.checkDefaultCheckbox ? await defaultCk.check({ force: true }) : await defaultCk.uncheck({ force: true });
    }
  }

  // radio
  if (body.radio) {
    const target =
      body.radio === "checked" ? page.getByLabel("Checked radio") : page.getByLabel("Default radio");
    await target.check({ force: true });
  }

  // color / date / range は値代入＋イベント発火で確実に反映
  if (body.color) {
    await page.locator('input[type="color"][name="my-colors"]').evaluate((el, v) => {
      const i = el as HTMLInputElement;
      i.value = String(v);
      i.dispatchEvent(new Event("input", { bubbles: true }));
      i.dispatchEvent(new Event("change", { bubbles: true }));
    }, body.color);
  }
  if (body.date) {
    const dateInput = page.locator('input[name="my-date"]');
    await dateInput.waitFor({ state: "attached", timeout: 10_000 });
    await dateInput.evaluate((el, v) => {
      const i = el as HTMLInputElement;
      i.value = String(v); // "YYYY-MM-DD"
      i.dispatchEvent(new Event("input", { bubbles: true }));
      i.dispatchEvent(new Event("change", { bubbles: true }));
    }, body.date);
  }
  if (typeof body.range === "number") {
    await page.locator('input[type="range"][name="my-range"]').evaluate((el, v) => {
      const i = el as HTMLInputElement;
      i.value = String(v);
      i.dispatchEvent(new Event("input", { bubbles: true }));
      i.dispatchEvent(new Event("change", { bubbles: true }));
    }, body.range);
  }

  // 送信
  await page.getByRole("button", { name: "Submit" }).click();

  // 完了ページの文言を検証（"Form submitted" / "Received!" が表示）
  await page.waitForURL(/submitted-form\.html/i, { timeout: 15_000 });
  await page.getByText("Form submitted").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("Received!").waitFor({ state: "visible", timeout: 10_000 });

  // ===== URLクエリ検証 =====
  const currentUrl = page.url();
  const params = new URL(currentUrl).searchParams;
  const mismatches: string[] = [];

  const expectEq = (k: string, exp?: string) => {
    if (exp === undefined) return;
    const act = params.get(k);
    if (act !== exp) mismatches.push(`${k}: expected "${exp}", got "${act}"`);
  };

  // select はラベル → 値（One→"1", Two→"2", Three→"3"）
  const selectValueMap = { One: "1", Two: "2", Three: "3" } as const;
  const expectedSelect = body.select ? selectValueMap[body.select] : undefined;

  expectEq("my-text", body.text);
  expectEq("my-password", body.password);
  expectEq("my-textarea", body.textarea);
  expectEq("my-select", expectedSelect);
  expectEq("my-colors", body.color);
  expectEq("my-date", body.date);
  if (body.range !== undefined) expectEq("my-range", String(body.range));

  // チェックボックスは同名が2つ（既定1つON）。DefaultをONにすると2件、OFFだと1件。
  if (body.checkDefaultCheckbox !== undefined) {
    const count = params.getAll("my-check").length;
    const expectedCount = body.checkDefaultCheckbox ? 2 : 1;
    if (count !== expectedCount) mismatches.push(`my-check count: expected ${expectedCount}, got ${count}`);
  }

  await page.waitForTimeout(body.waitAfterSubmitMs ?? 2_000);

  const title = await page.title();
  await sh.close();

  return c.json(
    {
      ok: mismatches.length === 0,
      title,
      url: currentUrl,
      assertions: { urlValuesOk: mismatches.length === 0, mismatches },
    },
    200
  );
}
