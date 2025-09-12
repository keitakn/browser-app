"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seleniumWebFormHandler = seleniumWebFormHandler;
var stagehand_1 = require("@browserbasehq/stagehand");
/** 公式 Selenium Web Form を自動入力→送信→検証 */
function seleniumWebFormHandler(c) {
    return __awaiter(this, void 0, void 0, function () {
        var body, openaiApiKey, isLocal, modelClientOptions, ctor, projectId, bbKey, sh, page, defaultCk, now, _a, target, dateInput, currentUrl, params, mismatches, expectEq, selectValueMap, expectedSelect, count, expectedCount, title;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, c.req.json()];
                case 1:
                    body = (_d.sent());
                    if (!(body === null || body === void 0 ? void 0 : body.text))
                        return [2 /*return*/, c.json({ ok: false, error: "text is required" }, 400)];
                    openaiApiKey = process.env.OPENAI_API_KEY;
                    if (!openaiApiKey) {
                        return [2 /*return*/, c.json({ ok: false, error: "OPENAI_API_KEY is missing" }, 500)];
                    }
                    isLocal = ((_b = process.env.STAGEHAND_ENV) !== null && _b !== void 0 ? _b : "LOCAL").toUpperCase() === "LOCAL";
                    modelClientOptions = { apiKey: openaiApiKey };
                    if (isLocal) {
                        ctor = {
                            env: "LOCAL",
                            modelName: "openai/gpt-5",
                            modelClientOptions: modelClientOptions,
                            localBrowserLaunchOptions: { headless: false, devtools: true },
                        };
                    }
                    else {
                        projectId = process.env.BROWSERBASE_PROJECT_ID;
                        bbKey = process.env.BROWSERBASE_API_KEY;
                        ctor = __assign({ env: "BROWSERBASE", modelName: "openai/gpt-5", modelClientOptions: modelClientOptions, projectId: projectId, browserbaseSessionCreateParams: {
                                projectId: projectId,
                                browserSettings: {
                                    viewport: { width: 1920, height: 1080 }, // Browserbase対応サイズ
                                    blockAds: true,
                                },
                            } }, (bbKey ? { apiKey: bbKey } : {}));
                    }
                    sh = new stagehand_1.Stagehand(ctor);
                    return [4 /*yield*/, sh.init()];
                case 2:
                    _d.sent();
                    page = sh.page;
                    if (!(isLocal && page.setViewportSize)) return [3 /*break*/, 4];
                    return [4 /*yield*/, page.setViewportSize({ width: 1920, height: 1080 })];
                case 3:
                    _d.sent();
                    _d.label = 4;
                case 4: 
                // 公式デモフォーム
                return [4 /*yield*/, page.goto("https://www.selenium.dev/selenium/web/web-form.html")];
                case 5:
                    // 公式デモフォーム
                    _d.sent(); // フィールド一覧あり。:contentReference[oaicite:1]{index=1}
                    // ===== 入力（決定的操作）=====
                    // text / password / textarea
                    return [4 /*yield*/, page.locator('input[name="my-text"]').fill(body.text)];
                case 6:
                    // ===== 入力（決定的操作）=====
                    // text / password / textarea
                    _d.sent();
                    if (!(body.password !== undefined)) return [3 /*break*/, 8];
                    return [4 /*yield*/, page.locator('input[name="my-password"]').fill(body.password)];
                case 7:
                    _d.sent();
                    _d.label = 8;
                case 8:
                    if (!(body.textarea !== undefined)) return [3 /*break*/, 10];
                    return [4 /*yield*/, page.locator('textarea[name="my-textarea"]').fill(body.textarea)];
                case 9:
                    _d.sent();
                    _d.label = 10;
                case 10:
                    if (!body.select) return [3 /*break*/, 12];
                    return [4 /*yield*/, page.locator('select[name="my-select"]').selectOption({ label: body.select })];
                case 11:
                    _d.sent();
                    _d.label = 12;
                case 12:
                    if (!(typeof body.checkDefaultCheckbox === "boolean")) return [3 /*break*/, 18];
                    defaultCk = page.getByLabel("Default checkbox");
                    return [4 /*yield*/, defaultCk.isChecked()];
                case 13:
                    now = _d.sent();
                    if (!(now !== body.checkDefaultCheckbox)) return [3 /*break*/, 18];
                    if (!body.checkDefaultCheckbox) return [3 /*break*/, 15];
                    return [4 /*yield*/, defaultCk.check({ force: true })];
                case 14:
                    _a = _d.sent();
                    return [3 /*break*/, 17];
                case 15: return [4 /*yield*/, defaultCk.uncheck({ force: true })];
                case 16:
                    _a = _d.sent();
                    _d.label = 17;
                case 17:
                    _a;
                    _d.label = 18;
                case 18:
                    if (!body.radio) return [3 /*break*/, 20];
                    target = body.radio === "checked" ? page.getByLabel("Checked radio") : page.getByLabel("Default radio");
                    return [4 /*yield*/, target.check({ force: true })];
                case 19:
                    _d.sent();
                    _d.label = 20;
                case 20:
                    if (!body.color) return [3 /*break*/, 22];
                    return [4 /*yield*/, page.locator('input[type="color"][name="my-colors"]').evaluate(function (el, v) {
                            var i = el;
                            i.value = String(v);
                            i.dispatchEvent(new Event("input", { bubbles: true }));
                            i.dispatchEvent(new Event("change", { bubbles: true }));
                        }, body.color)];
                case 21:
                    _d.sent();
                    _d.label = 22;
                case 22:
                    if (!body.date) return [3 /*break*/, 25];
                    dateInput = page.locator('input[name="my-date"]');
                    return [4 /*yield*/, dateInput.waitFor({ state: "attached", timeout: 10000 })];
                case 23:
                    _d.sent();
                    return [4 /*yield*/, dateInput.evaluate(function (el, v) {
                            var i = el;
                            i.value = String(v); // "YYYY-MM-DD"
                            i.dispatchEvent(new Event("input", { bubbles: true }));
                            i.dispatchEvent(new Event("change", { bubbles: true }));
                        }, body.date)];
                case 24:
                    _d.sent();
                    _d.label = 25;
                case 25:
                    if (!(typeof body.range === "number")) return [3 /*break*/, 27];
                    return [4 /*yield*/, page.locator('input[type="range"][name="my-range"]').evaluate(function (el, v) {
                            var i = el;
                            i.value = String(v);
                            i.dispatchEvent(new Event("input", { bubbles: true }));
                            i.dispatchEvent(new Event("change", { bubbles: true }));
                        }, body.range)];
                case 26:
                    _d.sent();
                    _d.label = 27;
                case 27: 
                // 送信
                return [4 /*yield*/, page.getByRole("button", { name: "Submit" }).click()];
                case 28:
                    // 送信
                    _d.sent();
                    // 完了ページの文言を検証（"Form submitted" / "Received!" が表示）
                    return [4 /*yield*/, page.waitForURL(/submitted-form\.html/i, { timeout: 15000 })];
                case 29:
                    // 完了ページの文言を検証（"Form submitted" / "Received!" が表示）
                    _d.sent();
                    return [4 /*yield*/, page.getByText("Form submitted").waitFor({ state: "visible", timeout: 10000 })];
                case 30:
                    _d.sent();
                    return [4 /*yield*/, page.getByText("Received!").waitFor({ state: "visible", timeout: 10000 })];
                case 31:
                    _d.sent();
                    currentUrl = page.url();
                    params = new URL(currentUrl).searchParams;
                    mismatches = [];
                    expectEq = function (k, exp) {
                        if (exp === undefined)
                            return;
                        var act = params.get(k);
                        if (act !== exp)
                            mismatches.push("".concat(k, ": expected \"").concat(exp, "\", got \"").concat(act, "\""));
                    };
                    selectValueMap = { One: "1", Two: "2", Three: "3" };
                    expectedSelect = body.select ? selectValueMap[body.select] : undefined;
                    expectEq("my-text", body.text);
                    expectEq("my-password", body.password);
                    expectEq("my-textarea", body.textarea);
                    expectEq("my-select", expectedSelect);
                    expectEq("my-colors", body.color);
                    expectEq("my-date", body.date);
                    if (body.range !== undefined)
                        expectEq("my-range", String(body.range));
                    // チェックボックスは同名が2つ（既定1つON）。DefaultをONにすると2件、OFFだと1件。
                    if (body.checkDefaultCheckbox !== undefined) {
                        count = params.getAll("my-check").length;
                        expectedCount = body.checkDefaultCheckbox ? 2 : 1;
                        if (count !== expectedCount)
                            mismatches.push("my-check count: expected ".concat(expectedCount, ", got ").concat(count));
                    }
                    return [4 /*yield*/, page.waitForTimeout((_c = body.waitAfterSubmitMs) !== null && _c !== void 0 ? _c : 2000)];
                case 32:
                    _d.sent();
                    return [4 /*yield*/, page.title()];
                case 33:
                    title = _d.sent();
                    return [4 /*yield*/, sh.close()];
                case 34:
                    _d.sent();
                    return [2 /*return*/, c.json({
                            ok: mismatches.length === 0,
                            title: title,
                            url: currentUrl,
                            assertions: { urlValuesOk: mismatches.length === 0, mismatches: mismatches },
                        }, 200)];
            }
        });
    });
}
