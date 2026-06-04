import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { formatDate, formatINR } from "@/lib/format";
import {
  PiggyBank,
  AlertTriangle,
  Banknote,
  TrendingUp,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({ meta: [{ title: "My Account — FundVault" }] }),
  component: MePage,
});

function MePage() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["me", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profile, contribs, missed, loans, ips, repays] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", userId!)
            .maybeSingle(),
          supabase
            .from("contributions")
            .select("*")
            .eq("member_id", userId!)
            .order("week_of", { ascending: false }),
          supabase
            .from("missed_contributions")
            .select("*")
            .eq("member_id", userId!)
            .order("week_of", { ascending: false }),
          supabase
            .from("loans")
            .select("*")
            .eq("member_id", userId!)
            .order("issued_on", { ascending: false }),
          supabase
            .from("interest_payments")
            .select("*")
            .eq("member_id", userId!)
            .order("due_on", { ascending: false }),
          supabase
            .from("repayments")
            .select("*")
            .eq("member_id", userId!)
            .order("paid_on", { ascending: false }),
        ]);

      const totalContrib = (contribs.data ?? []).reduce(
        (s, r) => s + Number(r.amount ?? 0),
        0
      );
      const totalPenaltyPaid = (missed.data ?? [])
  .filter((m) => m.resolved)
  .reduce((s, m) => s + Number(m.penalty ?? 0), 0);
      const activeLoans = (loans.data ?? []).filter(
        (l) => l.status === "active"
      );
      const totalActiveLoanAmount = activeLoans.reduce(
        (s, l) => s + Number(l.principal ?? 0),
        0
      );
      const totalPrincipalRepaid = (repays.data ?? []).reduce(
        (s, r) => s + Number(r.principal_paid ?? 0),
        0
      );
      const totalInterestPaid = (repays.data ?? []).reduce(
        (s, r) => s + Number(r.interest_paid ?? 0),
        0
      );
      const totalPenaltyLoanPaid = (repays.data ?? []).reduce(
        (s, r) => s + Number(r.penalty_paid ?? 0),
        0
      );
      const upcoming = (ips.data ?? [])
        .filter((p) => p.status !== "paid")
        .sort((a, b) => a.due_on.localeCompare(b.due_on))[0];

      return {
        profile: profile.data,
        contribs: contribs.data ?? [],
        missed: missed.data ?? [],
        loans: loans.data ?? [],
        ips: ips.data ?? [],
        repays: repays.data ?? [],

        totalContrib,
        totalPenaltyPaid,
        missedCount: (missed.data ?? []).filter((m) => !m.resolved).length,
        totalActiveLoanAmount,
        remaining: totalActiveLoanAmount - totalPrincipalRepaid,
        totalPrincipalRepaid,
        totalInterestPaid,
        totalPenaltyLoanPaid,
        upcoming,
      };
    },
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-6 text-destructive">Failed to load your data.</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="My Account" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard
          label="My Contributions"
          value={formatINR(data?.totalContrib ?? 0)}
          icon={<PiggyBank className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Penalty Paid"
          value={formatINR(data?.totalPenaltyPaid ?? 0)}
          hint={`${data?.missedCount ?? 0} missed weeks`}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="warning"
        />
        <StatCard
          label="Active Loans"
          value={formatINR(data?.totalActiveLoanAmount ?? 0)}
          icon={<Banknote className="h-4 w-4" />}
          hint={`Remaining ${formatINR(data?.remaining ?? 0)}`}
        />
        <StatCard
          label="Principal Repaid"
          value={formatINR(data?.totalPrincipalRepaid ?? 0)}
          icon={<Banknote className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Interest Paid"
          value={formatINR(data?.totalInterestPaid ?? 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="success"
        />
      </div>

      {data?.upcoming && (
        <div className="rounded-xl border bg-card shadow-card p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-warning/15 text-warning flex items-center justify-center">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">
              Upcoming interest payment
            </div>
            <div className="font-display text-lg font-semibold">
              {formatINR(data.upcoming.interest_amount)} due on{" "}
              {formatDate(data.upcoming.due_on)}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Contribution History">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week of</TableHead>
                <TableHead>Paid on</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.contribs ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{formatDate(c.week_of)}</TableCell>
                  <TableCell>{formatDate(c.paid_on)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(c.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {data?.contribs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground text-sm py-6"
                  >
                    No contributions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard title="Missed Contributions">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week of</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Penalty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.missed ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{formatDate(m.week_of)}</TableCell>
                  <TableCell>
                    {m.resolved ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Resolved
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(m.penalty)}
                  </TableCell>
                </TableRow>
              ))}
              {data?.missed.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground text-sm py-6"
                  >
                    No missed weeks. Well done!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b">
        <h3 className="font-display font-semibold">{title}</h3>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}