import {
  buildMockFinish,
  buildMockLeaderboard,
  buildMockReferrals,
  buildMockTasks,
  mockAttempts,
  mockAuthResponse,
  mockChallenge,
  mockGameStart,
  mockMe,
  mockProfile,
  mockSeason,
  mockSubscriptionStatus,
} from "./mockData";

/**
 * Design-QA mode: `?mock=1` (optionally `&scenario=empty`) makes the app run
 * entirely against canned fixtures instead of a live backend, so every
 * screen/state can be inspected without a running API + Postgres. Dev-only:
 * every call site is behind `import.meta.env.DEV`, a compile-time constant
 * Vite strips from production builds, so none of this reaches a real
 * deployment.
 */
function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export function enableMocksIfRequested(): void {
  if (!import.meta.env.DEV) return;

  const params = new URLSearchParams(window.location.search);
  if (params.get("mock") !== "1") return;

  const scenario = params.get("scenario") ?? "populated";
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const { pathname, searchParams } = new URL(url, window.location.origin);
    const method = (init?.method ?? "GET").toUpperCase();

    await new Promise((resolve) => setTimeout(resolve, 250)); // realistic latency for skeletons

    if (pathname === "/api/auth/telegram") return json(mockAuthResponse);
    if (pathname === "/api/subscription/status" || pathname === "/api/subscription/check") {
      const subscribed = scenario !== "notsubscribed";
      return json({
        subscribed,
        channelUsername: mockSubscriptionStatus.channelUsername,
        channels: [
          { username: "ivKamaDesign", title: "@ivKamaDesign", subscribed },
          ...(subscribed ? [] : [{ username: "second_channel", title: "Second Channel", subscribed: false }]),
        ],
      });
    }
    if (pathname === "/api/me") return json(mockMe);
    if (pathname === "/api/seasons/current") {
      return json(scenario === "ended" ? { ...mockSeason, status: "ended", daysRemaining: 0 } : mockSeason);
    }
    if (pathname === "/api/leaderboard") {
      const result = buildMockLeaderboard(scenario);
      result.period = (searchParams.get("period") as typeof result.period) ?? "day";
      return json(result);
    }
    if (pathname === "/api/game/attempts") return json(mockAttempts);
    if (pathname === "/api/game/start" || /^\/api\/challenges\/[^/]+\/play$/.test(pathname)) {
      return json(mockGameStart);
    }
    if (pathname === "/api/game/finish" && init?.body) {
      const body = JSON.parse(String(init.body)) as { score: number };
      return json(buildMockFinish(body.score));
    }
    if (pathname === "/api/tasks") return json(buildMockTasks(scenario));
    if (/^\/api\/tasks\/.+\/claim$/.test(pathname)) {
      const tasks = buildMockTasks("populated").tasks;
      const key = pathname.split("/")[3];
      const task = tasks.find((t) => t.key === key)!;
      return json({ task: { ...task, claimed: true, completed: true, claimable: false }, attemptsGranted: task.rewardAttempts });
    }
    if (pathname === "/api/referrals") return json(buildMockReferrals(scenario));
    if (pathname === "/api/profile") return json(mockProfile);
    if (pathname === "/api/challenges" && method === "POST") return json(mockChallenge);
    if (/^\/api\/challenges\/[^/]+$/.test(pathname) && method === "GET") return json(mockChallenge);

    return originalFetch(input, init);
  };

  console.info(`[BATTLE mock mode] scenario="${scenario}" — all /api requests are faked.`);
}
