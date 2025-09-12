import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { seleniumWebFormHandler } from "./handlers/seleniumWebForm.js";

const app = new Hono();

const selenium = new Hono();
selenium.post("/webform", seleniumWebFormHandler);
app.route("/selenium", selenium);

app.get("/healthz", (c) => c.text("ok"));

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port });
