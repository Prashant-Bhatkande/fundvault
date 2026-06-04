import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  PiggyBank,
  Banknote,
  TrendingUp,
  AlertTriangle,
  Users,
  Wallet,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — FundVault" }] }),
  component: DashboardPage,
});

async function fetchOverview() {
  const [contribsRes, loansRes, ipRes, repaysRes, missedRes, membersRes, requestsRes] =
    await Promise.all([
      supabase.from("contributions").select("amount, penalty_amount, paid_on, week_of"),
      supabase.from("loans").select("id, principal, status, issued_on"),
      supabase.from("interest_payments").select("paid_amount, penalty, paid_on"),
      supabase
  .from("repayments")
  .select("principal_paid, interest_paid, penalty_paid, paid_on"),
      supabase.from("missed_contributions").select("penalty, resolved"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("loan_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

  const contribs = contribsRes.data ?? [];
  const loans = loansRes.data ?? [];
  const ips = ipRes.data ?? [];
  const repays = repaysRes.data ?? [];
  const missed = missedRes.data ?? [];
const totalContrib = contribs.reduce(
  (s, r) => s + Number(r.amount),
  0
);

const contributionPenalties = contribs.reduce(
  (s, r) => s + Number(r.penalty_amount ?? 0),
  0
);

const totalInterest = ips.reduce(
  (s, r) => s + Number(r.paid_amount ?? 0),
  0
);

const totalPrincipalRepaid = repays.reduce(
  (s, r) => s + Number(r.principal_paid ?? 0),
  0
);

const totalInterestFromLoans = repays.reduce(
  (s, r) => s + Number(r.interest_paid ?? 0),
  0
);

const totalPenaltyFromLoans = repays.reduce(
  (s, r) => s + Number(r.penalty_paid ?? 0),
  0
);

const totalPenalties =
  contributionPenalties +
  ips.reduce(
    (s, r) => s + Number(r.penalty ?? 0),
    0
  ) +
  totalPenaltyFromLoans;

const activeLoanPrincipal = loans
  .filter((l) => l.status === "active")
  .reduce(
    (s, r) => s + Number(r.principal),
    0
  );

const outstanding =
  activeLoanPrincipal -
  totalPrincipalRepaid;

const fundBalance =
  totalContrib +
  totalInterest +
  totalInterestFromLoans +
  totalPenalties -
  Math.max(0, outstanding);

const availableCash =
  totalContrib +
  totalInterest +
  totalInterestFromLoans +
  totalPenalties +
  totalPrincipalRepaid -
  loans.reduce(
    (s, r) => s + Number(r.principal),
    0
  );
 

  // Monthly growth chart (last 6 months)
  const months: { key: string; label: string; contrib: number; interest: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: d.toLocaleDateString("en-IN", { month: "short" }),
      contrib: 0,
      interest: 0,
    });
  }
  for (const c of contribs) {
    const k = String(c.paid_on).slice(0, 7);
    const m = months.find((x) => x.key === k);
    if (m) m.contrib += Number(c.amount);
  }
  for (const ip of ips) {
    if (!ip.paid_on) continue;
    const k = String(ip.paid_on).slice(0, 7);
    const m = months.find((x) => x.key === k);
    if (m) m.interest += Number(ip.paid_amount);
  }

  // Loan distribution by status
  const distribution = ["active", "closed", "defaulted"].map((s) => ({
    status: s,
    count: loans.filter((l) => l.status === s).length,
  }));

  return {
  fundBalance,
  availableCash,
  totalContrib,
  totalInterest,
  totalInterestFromLoans,
  totalPenalties,
  totalPrincipalRepaid,
  totalPenaltyFromLoans,
  activeLoans: loans.filter((l) => l.status === "active").length,
  pendingRequests: requestsRes.count ?? 0,
  totalMembers: membersRes.count ?? 0,
  outstanding,
  months,
  distribution,
};
}

function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: fetchOverview });

  return (
    <div>
      <PageHeader
        title="Fund Overview"
        description="A live snapshot of contributions, loans and balances."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Fund Balance"
          value={formatINR(data?.fundBalance ?? 0)}
          icon={<Wallet className="h-4 w-4" />}
          tone="default"
          hint="Total assets minus outstanding loans"
        />
        <StatCard
          label="Total Contributions"
          value={formatINR(data?.totalContrib ?? 0)}
          icon={<PiggyBank className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
  label="Interest Earned"
  value={formatINR(
    (data?.totalInterest ?? 0) +
    (data?.totalInterestFromLoans ?? 0)
  )}
  icon={<TrendingUp className="h-4 w-4" />}
  tone="success"
/>
        <StatCard
          label="Penalties Collected"
          value={formatINR(data?.totalPenalties ?? 0)}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="warning"
        />
        <StatCard
          label="Active Loans"
          value={data?.activeLoans ?? 0}
          icon={<Banknote className="h-4 w-4" />}
          hint={`${formatINR(Math.max(0, data?.outstanding ?? 0))} outstanding`}
        />
        <StatCard
          label="Pending Requests"
          value={data?.pendingRequests ?? 0}
          icon={<Clock className="h-4 w-4" />}
          tone="warning"
        />
        <StatCard
          label="Members"
          value={data?.totalMembers ?? 0}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Available Cash"
          value={formatINR(data?.availableCash ?? 0)}
          icon={<ArrowUpRight className="h-4 w-4" />}
          tone="default"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-card">
          <h3 className="font-display text-lg font-semibold mb-1">Monthly Growth</h3>
          <p className="text-xs text-muted-foreground mb-4">Contributions and interest collected per month.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.months ?? []}>
                <defs>
                  <linearGradient id="c1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="c2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    color: "var(--color-popover-foreground)",
                  }}
                />
                <Area type="monotone" dataKey="contrib" name="Contributions" stroke="var(--color-chart-1)" fill="url(#c1)" />
                <Area type="monotone" dataKey="interest" name="Interest" stroke="var(--color-chart-2)" fill="url(#c2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h3 className="font-display text-lg font-semibold mb-1">Loan Distribution</h3>
          <p className="text-xs text-muted-foreground mb-4">By current status.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.distribution ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="status" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-xs text-muted-foreground mt-4">Refreshing…</div>
      )}
    </div>
  );
}
