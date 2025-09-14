import { describe, it, expect } from "vitest";

describe("seleniumWebFormHandler E2E Tests", () => {
  const baseUrl = "http://localhost:8080";

  it("should submit form successfully with all fields", async () => {
    const requestBody = {
      text: "ねこちゃん",
      password: "password456789",
      textarea: "こんにちは",
      select: "Two",
      checkDefaultCheckbox: true,
      radio: "checked",
      color: "#ffff00",
      date: "2025-09-12",
      range: 3,
      waitAfterSubmitMs: 2000,
    };

    const response = await fetch(`${baseUrl}/selenium/webform`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);

    const result = await response.json();

    // 必須フィールドの存在確認
    expect(result).toHaveProperty("ok");
    expect(result).toHaveProperty("requestId");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("assertions");

    // 成功条件の確認
    expect(result.ok).toBe(true);
    expect(result.assertions.urlValuesOk).toBe(true);
    expect(result.assertions.mismatches).toEqual([]);

    // タイトルとURLの確認
    expect(result.title).toContain("Web form");
    expect(result.url).toContain("submitted-form.html");

    // requestIdがUUID形式であることを確認
    expect(result.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // screenshotUrlが存在する場合は文字列であることを確認
    if (result.screenshotUrl !== null) {
      expect(typeof result.screenshotUrl).toBe("string");
    }
  });

  it("should return 400 when text field is missing", async () => {
    const requestBody = {
      password: "password456789",
    };

    const response = await fetch(`${baseUrl}/selenium/webform`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(400);

    const result = await response.json();
    expect(result.ok).toBe(false);
    expect(result.error).toBe("text is required");
  });

  it("should submit form with only required field (text)", async () => {
    const requestBody = {
      text: "最小テスト",
    };

    const response = await fetch(`${baseUrl}/selenium/webform`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.ok).toBe(true);
    expect(result.assertions.urlValuesOk).toBe(true);
  });
});
