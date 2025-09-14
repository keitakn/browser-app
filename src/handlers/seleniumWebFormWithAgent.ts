// src/handlers/seleniumWebForm.ts
import type { Context } from "hono";
import {
  Stagehand,
  type ConstructorParams,
  type LogLine,
  type Page,
} from "@browserbasehq/stagehand";
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

/**
 * YYYY-MM-DD形式の日付をMM/DD/YYYY形式に変換する
 */
function convertToMMDDYYYY(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${month}/${day}/${year}`;
}

interface ActionLog {
  type: string;
  field: string;
  value: string | number | boolean;
  success?: boolean;
  finalValue?: string | null;
}

/**
 * Playwrightを使ってSelenium Web Formを確実に操作する関数
 */
async function fillFormWithPlaywright(page: Page, body: SeleniumWebFormRequestBody) {
  const startTime = Date.now();
  const actions: ActionLog[] = [];

  try {
    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState("networkidle");

    // 基本的なテキストフィールドを埋める
    if (body.text) {
      await page.fill('input[name="my-text"]', body.text);
      actions.push({ type: "fill", field: "text", value: body.text });
    }

    if (body.password) {
      await page.fill('input[name="my-password"]', body.password);
      actions.push({ type: "fill", field: "password", value: "[REDACTED]" });
    }

    if (body.textarea) {
      await page.fill('textarea[name="my-textarea"]', body.textarea);
      actions.push({ type: "fill", field: "textarea", value: body.textarea });
    }

    // Selectドロップダウンの操作
    if (body.select) {
      const selectValue = { One: "1", Two: "2", Three: "3" }[body.select];
      await page.selectOption('select[name="my-select"]', selectValue);
      actions.push({ type: "select", field: "select", value: body.select });
    }

    // Checkboxの操作
    if (body.checkDefaultCheckbox !== undefined) {
      const defaultCheckbox = page.locator('input[type="checkbox"]:not([checked])').first();
      if (body.checkDefaultCheckbox) {
        await defaultCheckbox.check();
        actions.push({ type: "check", field: "default-checkbox", value: true });
      } else {
        await defaultCheckbox.uncheck();
        actions.push({ type: "uncheck", field: "default-checkbox", value: false });
      }
    }

    // Radioボタンの操作
    if (body.radio === "checked") {
      await page.check("#my-radio-2"); // Checked radio
      actions.push({ type: "radio", field: "radio", value: "checked" });
    } else {
      await page.check("#my-radio-1"); // Default radio
      actions.push({ type: "radio", field: "radio", value: "default" });
    }

    // 特殊なフィールド（Color, Date, Range）を個別に操作

    // Color picker - 複数のアプローチで設定
    if (body.color) {
      try {
        // アプローチ1: fill()メソッドを試す
        await page.fill('input[type="color"]', body.color);
      } catch {
        // アプローチ2: JavaScriptで直接設定
        await page.evaluate((color: string) => {
          const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement;
          if (colorInput) {
            colorInput.value = color;
            colorInput.dispatchEvent(new Event("input", { bubbles: true }));
            colorInput.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, body.color);
      }
      actions.push({ type: "color", field: "color", value: body.color });
    }

    // Date picker - 成功している seleniumWebForm.ts と同じアプローチを使用
    if (body.date) {
      console.log(`[DEBUG] Setting date picker to: ${body.date} (using proven approach)`);

      try {
        const dateInput = page.locator('input[name="my-date"]');
        await dateInput.waitFor({ state: "attached", timeout: 10_000 });

        await dateInput.evaluate((el: Element, v: string) => {
          const i = el as HTMLInputElement;
          i.value = String(v); // "YYYY-MM-DD"
          i.dispatchEvent(new Event("input", { bubbles: true }));
          i.dispatchEvent(new Event("change", { bubbles: true }));
        }, body.date);

        // 設定確認
        const finalValue = await dateInput.evaluate(
          (el: Element) => (el as HTMLInputElement).value,
        );
        console.log(`[DEBUG] Date set successfully using locator: ${finalValue}`);

        actions.push({
          type: "date",
          field: "date",
          value: body.date,
          success: finalValue === body.date,
          finalValue,
        });
      } catch (error) {
        console.error(`[ERROR] Failed to set date picker: ${error}`);
        actions.push({
          type: "date",
          field: "date",
          value: body.date,
          success: false,
          finalValue: null,
        });
      }
    }

    // Range slider - 複数のアプローチで設定
    if (body.range !== undefined) {
      try {
        // アプローチ1: fill()メソッドを試す
        await page.fill('input[type="range"]', String(body.range));
      } catch {
        // アプローチ2: JavaScriptで直接設定
        await page.evaluate((range: number) => {
          const rangeInput = document.querySelector('input[type="range"]') as HTMLInputElement;
          if (rangeInput) {
            rangeInput.value = String(range);
            rangeInput.dispatchEvent(new Event("input", { bubbles: true }));
            rangeInput.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, body.range);
      }
      actions.push({ type: "range", field: "range", value: body.range });
    }

    // フォーム送信前の最終確認と修正
    console.log("[DEBUG] Pre-submit validation and fixes...");

    // 全てのフィールドの状態を確認
    const allFieldsStatus = await page.evaluate(() => {
      const fields = {
        "my-text":
          (document.querySelector('input[name="my-text"]') as HTMLInputElement)?.value || null,
        "my-password":
          (document.querySelector('input[name="my-password"]') as HTMLInputElement)?.value || null,
        "my-textarea":
          (document.querySelector('textarea[name="my-textarea"]') as HTMLTextAreaElement)?.value ||
          null,
        "my-date":
          (document.querySelector('input[name="my-date"]') as HTMLInputElement)?.value || null,
        "my-colors":
          (document.querySelector('input[name="my-colors"]') as HTMLInputElement)?.value || null,
        "my-range":
          (document.querySelector('input[name="my-range"]') as HTMLInputElement)?.value || null,
      };

      // フィールドの状態も確認
      const dateInput = document.querySelector('input[name="my-date"]') as HTMLInputElement;
      const fieldInfo = {
        disabled: dateInput?.disabled || false,
        readonly: dateInput?.readOnly || false,
        type: dateInput?.type || "unknown",
        name: dateInput?.name || "unknown",
      };

      return { fields, fieldInfo };
    });

    console.log(
      "[DEBUG] All fields before submit:",
      JSON.stringify(allFieldsStatus.fields, null, 2),
    );
    console.log("[DEBUG] Date field info:", JSON.stringify(allFieldsStatus.fieldInfo, null, 2));

    // Date pickerの最終確認と修正
    if (body.date && allFieldsStatus.fields["my-date"] !== body.date) {
      console.log(
        `[WARNING] Date value mismatch before submit. Expected: ${body.date}, Got: ${allFieldsStatus.fields["my-date"]}`,
      );
      console.log("[DEBUG] Attempting comprehensive date fix...");

      // より確実な値設定
      const fixResult = await page.evaluate((expectedDate: string) => {
        const dateInput = document.querySelector('input[name="my-date"]') as HTMLInputElement;
        if (dateInput) {
          // 1. disabled/readonly状態を一時的に解除
          const wasDisabled = dateInput.disabled;
          const wasReadonly = dateInput.readOnly;
          dateInput.disabled = false;
          dateInput.readOnly = false;

          // 2. 複数の方法で値を設定
          dateInput.value = expectedDate;
          dateInput.setAttribute("value", expectedDate);
          dateInput.defaultValue = expectedDate;

          // 3. フォーカスしてから値を設定（より確実）
          dateInput.focus();
          dateInput.select();
          dateInput.value = expectedDate;

          // 4. イベントを発火
          dateInput.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
          dateInput.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
          dateInput.dispatchEvent(new Event("blur", { bubbles: true }));

          // 5. 元の状態に戻す
          dateInput.disabled = wasDisabled;
          dateInput.readOnly = wasReadonly;

          return {
            success: true,
            finalValue: dateInput.value,
            wasDisabled,
            wasReadonly,
          };
        }
        return { success: false, finalValue: null, wasDisabled: false, wasReadonly: false };
      }, body.date);

      console.log(`[DEBUG] Comprehensive fix result: ${JSON.stringify(fixResult)}`);

      // 最終確認を少し待つ
      await page.waitForTimeout(100);

      const finalCheck = await page.evaluate(() => {
        const input = document.querySelector('input[name="my-date"]') as HTMLInputElement;
        return input ? input.value : null;
      });
      console.log(`[DEBUG] Final check after comprehensive fix: ${finalCheck}`);
    }

    // フォーム送信直前の最終状態確認
    console.log("[DEBUG] Final form state before submit...");
    const finalFormState = await page.evaluate(() => {
      const form = document.querySelector("form");
      if (!form) return {};

      const _formData = new FormData(form);
      const data: Record<string, string> = {};

      // FormData.entries() のポリフィルとして手動で収集
      const inputs = form.querySelectorAll("input, textarea, select");
      inputs.forEach((input) => {
        const element = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        if (element.name && !element.disabled) {
          if (element.type === "checkbox" || element.type === "radio") {
            if ((element as HTMLInputElement).checked) {
              data[element.name] = element.value || "on";
            }
          } else {
            data[element.name] = element.value;
          }
        }
      });

      return data;
    });
    console.log("[DEBUG] FormData just before submit:", JSON.stringify(finalFormState, null, 2));

    // フォームの送信
    await page.click('button[type="submit"]');
    actions.push({ type: "click", field: "submit", value: "submit-button" });

    const endTime = Date.now();

    return {
      success: true,
      message: "Form filled and submitted successfully using Playwright",
      completed: true,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        inference_time_ms: endTime - startTime,
      },
      actions,
    };
  } catch (error) {
    const endTime = Date.now();

    return {
      success: false,
      message: `Form filling failed: ${error instanceof Error ? error.message : String(error)}`,
      completed: false,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        inference_time_ms: endTime - startTime,
      },
      actions,
    };
  }
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

  // ===== ハイブリッドアプローチ：Playwrightで確実にフォームを操作 =====
  const agentResult = await fillFormWithPlaywright(page, body);

  // ===== 完了文言とURL検証（エラーハンドリング強化） =====
  try {
    // URL遷移の確認
    const currentUrl = page.url();
    if (!currentUrl.includes("submitted-form")) {
      await page.waitForURL(/submitted-form\.html/i, { timeout: 15_000 });
    }

    // 成功メッセージの確認
    await page.getByText("Form submitted").waitFor({ state: "visible", timeout: 10_000 });
    await page.getByText("Received!").waitFor({ state: "visible", timeout: 10_000 });

    console.log("[SUCCESS] Form submission completed successfully");
  } catch (error) {
    console.error("[ERROR] Form submission verification failed:", error);

    // 現在のURLとページ状態をログに記録
    const currentUrl = page.url();
    console.log(`[DEBUG] Current URL: ${currentUrl}`);

    // スクリーンショットを撮影（デバッグ用）
    try {
      const screenshot = await page.screenshot({ type: "png" });
      console.log(`[DEBUG] Screenshot captured (${screenshot.length} bytes)`);
    } catch (screenshotError) {
      console.warn("[WARNING] Failed to capture screenshot:", screenshotError);
    }

    // すでに正しいページにいる場合は続行
    if (currentUrl.includes("submitted-form")) {
      console.log("[INFO] Already on submitted form page, continuing...");
    } else {
      // フォールバック：手動でSubmitボタンをクリック
      try {
        console.log("[FALLBACK] Attempting manual form submission...");
        await page.click('button[type="submit"]');
        await page.waitForURL(/submitted-form\.html/i, { timeout: 10_000 });
        console.log("[SUCCESS] Manual submission successful");
      } catch (fallbackError) {
        console.error("[ERROR] Manual submission also failed:", fallbackError);
        // このエラーは後続処理で処理される
      }
    }
  }

  const currentUrl = page.url();
  const params = new URL(currentUrl).searchParams;

  console.log(`[DEBUG] Final URL: ${currentUrl}`);
  console.log(`[DEBUG] URL Parameters:`, Object.fromEntries(params.entries()));

  const mismatches: string[] = [];
  const expectEq = (k: string, exp?: string, transform?: (value: string) => string) => {
    if (exp === undefined) return;
    let act = params.get(k);
    if (transform && act) {
      act = transform(act);
    }
    if (act !== exp) {
      mismatches.push(`${k}: expected "${exp}", got "${act}"`);
      console.log(`[VALIDATION ERROR] ${k}: expected "${exp}", got "${act}"`);
    } else {
      console.log(`[VALIDATION OK] ${k}: "${act}"`);
    }
  };

  const selectValueMap = { One: "1", Two: "2", Three: "3" } as const;
  const expectedSelect = body.select ? selectValueMap[body.select] : undefined;

  // 基本フィールドの検証
  expectEq("my-text", body.text);
  expectEq("my-password", body.password);
  expectEq("my-textarea", body.textarea);
  expectEq("my-select", expectedSelect);
  expectEq("my-colors", body.color);
  if (body.range !== undefined) expectEq("my-range", String(body.range));

  // 日付フィールドの検証（フォーマット変換を考慮）
  if (body.date) {
    const actualDate = params.get("my-date");
    if (actualDate) {
      // ブラウザが MM/DD/YYYY 形式で送信する場合に対応
      const expectedInBrowserFormat = convertToMMDDYYYY(body.date);
      if (actualDate !== body.date && actualDate !== expectedInBrowserFormat) {
        mismatches.push(
          `my-date: expected "${body.date}" or "${expectedInBrowserFormat}", got "${actualDate}"`,
        );
        console.log(
          `[VALIDATION ERROR] my-date: expected "${body.date}" or "${expectedInBrowserFormat}", got "${actualDate}"`,
        );
      } else {
        console.log(`[VALIDATION OK] my-date: "${actualDate}" (matches expected format)`);
      }
    } else {
      mismatches.push(`my-date: expected "${body.date}", got null`);
    }
  }

  // Checkboxの検証
  if (body.checkDefaultCheckbox !== undefined) {
    const checkValues = params.getAll("my-check");
    const count = checkValues.length;
    const expectedCount = body.checkDefaultCheckbox ? 2 : 1;
    if (count !== expectedCount) {
      mismatches.push(`my-check count: expected ${expectedCount}, got ${count}`);
      console.log(
        `[VALIDATION ERROR] my-check count: expected ${expectedCount}, got ${count} (values: ${checkValues.join(", ")})`,
      );
    } else {
      console.log(`[VALIDATION OK] my-check count: ${count}`);
    }
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
