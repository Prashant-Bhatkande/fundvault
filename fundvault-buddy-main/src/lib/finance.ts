// Pure financial calculations for FundVault.

export interface FinanceSettings {
  weekly_contribution: number;
  contribution_day: number; // 0 = Sunday
  missed_contribution_penalty: number;
  interest_rate_monthly: number; // 0.05 = 5%
  late_interest_penalty_rate: number; // 0.10 = ₹10 / ₹100
}

/** Get all Sunday (or settings.contribution_day) dates between two dates, inclusive of start, exclusive of future. */
export function listContributionDates(
  from: Date,
  to: Date,
  weekday: number,
): Date[] {
  const out: Date[] = [];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  // advance to first matching weekday on/after `from`
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  while (d <= to) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Compute missed weeks for a member given paid week_of dates and join date. */
export function computeMissed(
  joinDate: Date,
  paidWeeks: Set<string>,
  settings: FinanceSettings,
  now: Date = new Date(),
): { week: string; penalty: number }[] {
  const dates = listContributionDates(joinDate, now, settings.contribution_day);
  const missed: { week: string; penalty: number }[] = [];
  for (const d of dates) {
    const key = isoDate(d);
    if (!paidWeeks.has(key)) {
      missed.push({ week: key, penalty: settings.missed_contribution_penalty });
    }
  }
  return missed;
}

/** Monthly interest on a loan principal. */
export function monthlyInterest(principal: number, rate: number): number {
  return Math.round(principal * rate * 100) / 100;
}

/** Late-interest penalty: configurable rate per ₹1 of unpaid interest (default 0.10 = ₹10 per ₹100). */
export function latePenalty(unpaidInterest: number, rate: number): number {
  return Math.round(unpaidInterest * rate * 100) / 100;
}

/** Generate scheduled interest due dates for a loan, monthly until closure date or max duration. */
export function interestSchedule(
  issuedOn: Date,
  monthsMax: number,
  closedOn: Date | null = null,
): Date[] {
  const dates: Date[] = [];
  const end = closedOn ?? new Date();
  for (let i = 1; i <= monthsMax; i++) {
    const d = new Date(issuedOn);
    d.setMonth(d.getMonth() + i);
    if (d > end && !closedOn) break;
    dates.push(d);
    if (closedOn && d >= closedOn) break;
  }
  return dates;
}
