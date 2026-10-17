import { Capacitor } from "@capacitor/core";
import {
  coachFacts,
  coachSnapshot,
  type CoachSnapshot,
  type CoachTopic,
} from "./coach-contract";
import { type Observation, streetNames } from "./core/poker";

const endpoint =
  import.meta.env.VITE_COACH_URL ||
  (Capacitor.isNativePlatform() || "__TAURI_INTERNALS__" in window
    ? null
    : "/api/coach");
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

function localExplanation(snapshot: CoachSnapshot, topic: CoachTopic) {
  const facts = coachFacts(snapshot);
  if (topic === "price")
    return facts.directPricePercent !== null
      ? `跟注需要 ${facts.call} 灵石；你可竞争的投入在跟注后合计 ${facts.eligiblePotAfterCall}，直接价格门槛为 ${facts.directPricePercent}%。这不是实际胜率，不能单凭这个数决定跟注。后续下注、对手范围和边池资格仍要分别考虑。`
      : "当前没有需要补齐的跟注价格。轮到你时，先检查是否可以过牌；赔率为零不代表你能赢。";
  if (topic === "review")
    return facts.net !== null
      ? `本手净${facts.net >= 0 ? "得" : "支出"} ${Math.abs(facts.net)} 灵石。先回顾每轮行动时可知的信息，再考虑位置、范围与投入成本。一次输赢不足以判断决策优劣，可在「本手复盘」查看公开行动记录。`
      : "本手还未结束。先记住当前已知的信息与行动理由，结束后再对照公开行动复盘，避免用之后出现的牌倒推答案。";
  return `${streetNames[snapshot.street]}阶段。${facts.bestHand ? `当前最佳五张是${facts.bestHand}。` : facts.heroCards.length ? `你的底牌是 ${facts.heroCards.join(" ")}。` : ""}${snapshot.actor === 0 ? "轮到你行动，先观察跟注成本与合法加注范围。" : "先观察公开行动，底牌只对自己可见。"}牌型与价格是事实；对手范围仍然需要判断。`;
}

export function createMentorPanel(dialog: HTMLDialogElement) {
  let snapshot: CoachSnapshot | null = null,
    controller: AbortController | null = null,
    revision = 0;
  const topics = [
    ...dialog.querySelectorAll<HTMLButtonElement>("[data-coach-topic]"),
  ];
  function pending(value: boolean) {
    topics.forEach((button) => (button.disabled = value || !snapshot));
    element("coach-stop").hidden = !value;
    element("coach-reply").setAttribute("aria-busy", String(value));
  }
  function stop() {
    revision++;
    controller?.abort();
    controller = null;
    pending(false);
  }
  dialog.addEventListener("close", stop);
  element("coach-stop").addEventListener("click", () => {
    stop();
    element("coach-source").textContent = "已停止请教 · 本地指引仍可使用";
  });
  async function ask(topic: CoachTopic) {
    if (!snapshot) return;
    stop();
    const current = revision,
      stable = snapshot;
    const fallback = localExplanation(stable, topic);
    element("coach-reply").textContent = fallback;
    if (!endpoint || !navigator.onLine) {
      element("coach-source").textContent = !endpoint
        ? "AI 服务尚未配置 · 本地指引"
        : "当前离线 · 本地指引";
      return;
    }
    controller = new AbortController();
    const requestController = controller,
      signal = requestController.signal;
    const timeout = setTimeout(() => requestController.abort(), 14_000);
    pending(true);
    element("coach-source").textContent = "青玄师父正在思考…";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ topic, snapshot: stable }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 503 ? "unconfigured" : "unavailable",
        );
      const reply = await response.json();
      if (
        reply.source !== "model" ||
        typeof reply.text !== "string" ||
        !reply.text.trim() ||
        reply.text.length > 4_000
      )
        throw new Error("invalid");
      if (current !== revision || !dialog.open) return;
      // Model output is always plain text, never HTML, executable actions or a rules result.
      element("coach-reply").textContent = reply.text;
      element("coach-source").textContent =
        "AI 解读 · 可能有误，请结合程序事实判断";
    } catch (error) {
      if (current !== revision || !dialog.open) return;
      element("coach-reply").textContent = fallback;
      element("coach-source").textContent =
        error instanceof Error && error.message === "unconfigured"
          ? "AI 服务尚未配置 · 本地指引"
          : "AI 暂不可用 · 已保留本地指引";
    } finally {
      clearTimeout(timeout);
      if (current === revision) {
        controller = null;
        pending(false);
      }
    }
  }
  topics.forEach((button) =>
    button.addEventListener(
      "click",
      () => void ask(button.dataset.coachTopic as CoachTopic),
    ),
  );
  return {
    prepare(view: Observation | null) {
      stop();
      snapshot = view ? coachSnapshot(view) : null;
      pending(false);
      element("coach-source").textContent = "规则计算 · 本地";
      element("coach-reply").textContent = snapshot
        ? localExplanation(snapshot, "situation")
        : "先入席修炼，再带着当前局面向师父请教。你也可以先在修炼阁学习牌型与行动规则。";
      const facts = snapshot ? coachFacts(snapshot) : null;
      const rows = [
        ["阶段", snapshot ? streetNames[snapshot.street] : "尚未入席"],
        ["最佳牌型", facts?.bestHand || "等待公共牌"],
        [
          "跟注追加",
          facts?.call === null || !facts ? "—" : `${facts.call} 灵石`,
        ],
        [
          "直接价格",
          facts?.directPricePercent === null || !facts
            ? "—"
            : `${facts.directPricePercent}%`,
        ],
      ];
      const container = element("coach-facts");
      container.replaceChildren();
      for (const [label, value] of rows) {
        const row = document.createElement("div"),
          dt = document.createElement("dt"),
          dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = value;
        row.append(dt, dd);
        container.append(row);
      }
    },
    dispose: stop,
  };
}
