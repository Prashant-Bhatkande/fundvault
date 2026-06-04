import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { formatDate, formatINR } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({ meta: [{ title: "Members — FundVault" }] }),
  component: MembersPage,
});

function MembersPage() {
  const { isAdmin } = useAuth();

  const { data } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const [profiles, roles, contribs, missed, loans] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone, joined_at, active"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("contributions").select("member_id, amount"),
        supabase.from("missed_contributions").select("member_id, penalty, resolved"),
        supabase.from("loans").select("member_id, principal, status"),
      ]);

      const byMember = new Map<string, { contrib: number; missed: number; missedCount: number; activeLoan: number }>();

      for (const p of profiles.data ?? []) {
        byMember.set(p.id, { contrib: 0, missed: 0, missedCount: 0, activeLoan: 0 });
      }
      for (const c of contribs.data ?? []) {
        const r = byMember.get(c.member_id);
        if (r) r.contrib += Number(c.amount);
      }
      for (const m of missed.data ?? []) {
        const r = byMember.get(m.member_id);
        if (r) {
          r.missed += Number(m.penalty);
          if (!m.resolved) r.missedCount += 1;
        }
      }
      for (const l of loans.data ?? []) {
        if (l.status === "active") {
          const r = byMember.get(l.member_id);
          if (r) r.activeLoan += Number(l.principal);
        }
      }

      const roleMap = new Map<string, string[]>();
      for (const r of roles.data ?? []) {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role as string);
        roleMap.set(r.user_id, arr);
      }

      return (profiles.data ?? []).map((p) => ({
        ...p,
        roles: roleMap.get(p.id) ?? ["member"],
        stats: byMember.get(p.id)!,
      }));
    },
  });

  return (
    <div>
      <PageHeader
        title="Members"
        description={`${data?.length ?? 0} members in the fund. Private phone numbers are only visible to admins.`}
      />

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Contributions</TableHead>
                <TableHead className="text-right">Missed</TableHead>
                <TableHead className="text-right">Active Loan</TableHead>
                {isAdmin && <TableHead>Phone</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <UserIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{m.full_name}</div>
                        {!m.active && <div className="text-xs text-muted-foreground">Inactive</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {m.roles.map((r) => (
                        <Badge key={r} variant={r === "super_admin" ? "default" : r === "admin" ? "secondary" : "outline"} className="gap-1">
                          {r !== "member" && <Shield className="h-3 w-3" />}
                          {r.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(m.joined_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(m.stats.contrib)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.stats.missedCount > 0 ? (
                      <span className="text-warning">{m.stats.missedCount} ({formatINR(m.stats.missed)})</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.stats.activeLoan > 0 ? formatINR(m.stats.activeLoan) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  {isAdmin && <TableCell className="text-sm font-mono">{m.phone}</TableCell>}
                </TableRow>
              ))}
              {data && data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">
                    No members yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
