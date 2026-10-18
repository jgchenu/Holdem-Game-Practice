import { createCoachServer } from "./coach-server";

const port = Number(process.env.COACH_PORT || 8787);
const host = process.env.COACH_HOST || "127.0.0.1";
const server = createCoachServer({
  baseUrl: process.env.AI_BASE_URL || "",
  model: process.env.AI_MODEL || "",
  apiKey: process.env.AI_API_KEY || "",
  thinkingMode: (process.env.AI_THINKING || undefined) as "enabled" | "disabled" | undefined,
  origins: (
    process.env.COACH_ALLOWED_ORIGINS ||
    "http://localhost:5173,http://localhost:4173"
  )
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
});
server.listen(port, host, () =>
  console.log(`师父服务：http://${host}:${port}（/health 查看配置状态）`),
);
