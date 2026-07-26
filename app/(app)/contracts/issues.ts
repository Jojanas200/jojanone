// Deterministic contract health checks, mirrored from the prototype's
// contractIssues selector. Pure date maths on the record itself - no fetches -
// so the register, cards and drawer all agree on what needs attention.

export type ContractLike = {
  status: string;
  endDate: string | null;
  owner: string | null;
  noticePeriodDays: number | null;
  nextAction: string | null;
  nextActionDate: string | null;
};

const DAY = 86400000;

export function contractIssues(c: ContractLike, now = new Date()): string[] {
  const issues: string[] = [];
  const today = now.getTime();
  const end = c.endDate ? new Date(c.endDate).getTime() : null;

  if (c.status === "active" && !c.endDate)
    issues.push("No end date recorded for an active contract");
  if (c.status === "active" && !c.owner) issues.push("No owner assigned");
  if (c.status === "active" && end !== null && end < today)
    issues.push("End date has passed but the contract is still marked active");
  if (
    c.status === "active" &&
    end !== null &&
    end >= today &&
    end - today <= 30 * DAY
  )
    issues.push("Expires within 30 days");
  if (
    c.status === "active" &&
    end !== null &&
    c.noticePeriodDays != null &&
    c.noticePeriodDays > 0
  ) {
    const noticeBy = end - c.noticePeriodDays * DAY;
    if (noticeBy >= today && noticeBy - today <= 30 * DAY)
      issues.push("Notice deadline approaching");
    else if (noticeBy < today && end >= today)
      issues.push("Notice deadline has passed");
  }
  if (
    c.nextAction &&
    c.nextActionDate &&
    new Date(c.nextActionDate).getTime() < today
  )
    issues.push("Next action is overdue");

  return issues;
}
