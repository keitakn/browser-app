import { describe, it, expect } from "vitest";

describe("seleniumWebFormWithAgentHandler E2E Tests", () => {
  const baseUrl = "http://localhost:8080";

  it("should submit form successfully with agent", async () => {
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

    const response = await fetch(`${baseUrl}/selenium/webform/agent`, {
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
    expect(result).toHaveProperty("agent");

    // 成功条件の確認
    expect(result.ok).toBe(true);
    expect(result.assertions.urlValuesOk).toBe(true);
    expect(result.assertions.mismatches).toEqual([]);

    // Agent固有のフィールド確認
    expect(result.agent).toHaveProperty("success");
    expect(result.agent).toHaveProperty("message");
    expect(result.agent).toHaveProperty("completed");
    expect(result.agent).toHaveProperty("usage");
    expect(result.agent).toHaveProperty("actions");
    expect(result.agent).toHaveProperty("logs");

    expect(result.agent.success).toBe(true);
    expect(result.agent.completed).toBe(true);
    expect(Array.isArray(result.agent.actions)).toBe(true);
    expect(Array.isArray(result.agent.logs)).toBe(true);

    // タイトルとURLの確認
    expect(result.title).toContain("Web form");
    expect(result.url).toContain("submitted-form.html");
  });

  it("should return 400 when text field is missing", async () => {
    const requestBody = {
      password: "password456789",
    };

    const response = await fetch(`${baseUrl}/selenium/webform/agent`, {
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
});
