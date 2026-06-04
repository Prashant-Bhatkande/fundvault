import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — FundVault" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    // protect — only super admin
    // we still render gracefully but redirect
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (data) setForm({ ...data }); }, [data]);

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title="Settings" description="Restricted area." />
        <div className="rounded-xl border bg-card p-8 text-center shadow-card">
          <SettingsIcon className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Only Super Admins can change fund settings.</p>
          <Button className="mt-4" variant="secondary" onClick={() => navigate({ to: "/dashboard" })}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  if (isLoading || !form) return <div className="text-muted-foreground">Loading…</div>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("settings").update({
      weekly_contribution: Number(form.weekly_contribution),
      contribution_day: Number(form.contribution_day),
      missed_contribution_penalty: Number(form.missed_contribution_penalty),
      interest_rate_monthly: Number(form.interest_rate_monthly),
      late_interest_penalty_rate: Number(form.late_interest_penalty_rate),
      reserve_fund: Number(form.reserve_fund),
      max_loan_duration_months: Number(form.max_loan_duration_months),
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div>
      <PageHeader title="Fund Settings" description="Configure contribution and loan rules. No financial rule is hardcoded." />

      <form onSubmit={save} className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
        <Field label="Weekly contribution (₹)">
          <Input type="number" step="0.01" value={form.weekly_contribution} onChange={(e) => setForm({ ...form, weekly_contribution: e.target.value })} />
        </Field>
        <Field label="Contribution day">
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={form.contribution_day}
            onChange={(e) => setForm({ ...form, contribution_day: e.target.value })}
          >
            {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </Field>
        <Field label="Missed contribution penalty (₹)">
          <Input type="number" step="0.01" value={form.missed_contribution_penalty} onChange={(e) => setForm({ ...form, missed_contribution_penalty: e.target.value })} />
        </Field>
        <Field label="Monthly interest rate (e.g. 0.05 = 5%)">
          <Input type="number" step="0.0001" value={form.interest_rate_monthly} onChange={(e) => setForm({ ...form, interest_rate_monthly: e.target.value })} />
        </Field>
        <Field label="Late interest penalty rate (e.g. 0.10 = ₹10 per ₹100)">
          <Input type="number" step="0.0001" value={form.late_interest_penalty_rate} onChange={(e) => setForm({ ...form, late_interest_penalty_rate: e.target.value })} />
        </Field>
        <Field label="Reserve fund (₹)">
          <Input type="number" step="0.01" value={form.reserve_fund} onChange={(e) => setForm({ ...form, reserve_fund: e.target.value })} />
        </Field>
        <Field label="Max loan duration (months)">
          <Input type="number" value={form.max_loan_duration_months} onChange={(e) => setForm({ ...form, max_loan_duration_months: e.target.value })} />
        </Field>

        <div className="lg:col-span-2 flex justify-end">
          <Button type="submit">Save settings</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
