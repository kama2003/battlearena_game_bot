import { beforeEach, describe, expect, it, vi } from "vitest";

const subscriptionCheckCreate = vi.fn();
vi.mock("../../lib/prisma", () => ({
  prisma: { subscriptionCheck: { create: subscriptionCheckCreate } },
}));

const isUserSubscribedToChannel = vi.fn();
vi.mock("../telegram/client", () => ({ isUserSubscribedToChannel }));

const confirmReferralIfEligible = vi.fn();
vi.mock("../referrals/service", () => ({ confirmReferralIfEligible }));

const { checkSubscription } = await import("./service");

const user = { id: "user-1", telegramId: "111" } as never;

describe("checkSubscription", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records the check and returns true for a subscribed user", async () => {
    isUserSubscribedToChannel.mockResolvedValue(true);

    const result = await checkSubscription(user);

    expect(result).toBe(true);
    expect(subscriptionCheckCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", subscribed: true },
    });
  });

  it("tries to confirm a pending referral when the user is subscribed", async () => {
    isUserSubscribedToChannel.mockResolvedValue(true);

    await checkSubscription(user);

    expect(confirmReferralIfEligible).toHaveBeenCalledWith("user-1");
  });

  it("does not touch referrals when the user is not subscribed", async () => {
    isUserSubscribedToChannel.mockResolvedValue(false);

    const result = await checkSubscription(user);

    expect(result).toBe(false);
    expect(confirmReferralIfEligible).not.toHaveBeenCalled();
  });
});
