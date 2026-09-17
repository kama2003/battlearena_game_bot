import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", () => ({
  env: { REFERRAL_BONUS_ATTEMPTS: 1, BOT_USERNAME: "BattleBot" },
}));

const referralFindUnique = vi.fn();
const referralUpdateMany = vi.fn();
const userUpdate = vi.fn();
const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
  callback({
    referral: { updateMany: referralUpdateMany },
    user: { update: userUpdate },
  }),
);

vi.mock("../../lib/prisma", () => ({
  prisma: {
    referral: { findUnique: referralFindUnique },
    $transaction: transaction,
  },
}));

const { confirmReferralIfEligible } = await import("./service");

describe("confirmReferralIfEligible", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when the referred user has no referral record", async () => {
    referralFindUnique.mockResolvedValue(null);

    await confirmReferralIfEligible("user-without-referral");

    expect(transaction).not.toHaveBeenCalled();
  });

  it("does nothing when the referral is already confirmed", async () => {
    referralFindUnique.mockResolvedValue({ id: "ref-1", status: "CONFIRMED", referrerId: "r1" });

    await confirmReferralIfEligible("user-2");

    expect(transaction).not.toHaveBeenCalled();
  });

  it("confirms a pending referral exactly once and grants the referrer a bonus attempt", async () => {
    referralFindUnique.mockResolvedValue({
      id: "ref-1",
      status: "PENDING",
      referrerId: "referrer-1",
    });
    referralUpdateMany.mockResolvedValue({ count: 1 });

    await confirmReferralIfEligible("user-2");

    expect(referralUpdateMany).toHaveBeenCalledWith({
      where: { id: "ref-1", status: "PENDING", rewardGranted: false },
      data: expect.objectContaining({ status: "CONFIRMED", rewardGranted: true }),
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "referrer-1" },
      data: { bonusAttempts: { increment: 1 } },
    });
  });

  it("does not grant a bonus if a concurrent request already confirmed the referral", async () => {
    referralFindUnique.mockResolvedValue({
      id: "ref-1",
      status: "PENDING",
      referrerId: "referrer-1",
    });
    // A concurrent call already flipped it to CONFIRMED, so updateMany matches 0 rows.
    referralUpdateMany.mockResolvedValue({ count: 0 });

    await confirmReferralIfEligible("user-2");

    expect(userUpdate).not.toHaveBeenCalled();
  });
});
