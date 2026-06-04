import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { formatDate, formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, PiggyBank, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/contributions")({
  head: () => ({ meta: [{ title: "Contributions — FundVault" }] }),
  component: ContributionsPage,
});

function lastSunday(d = new Date()): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x.toISOString().slice(0, 10);
}

function ContributionsPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Edit state
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", week_of: "", paid_on: "" });

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["contributions-all"],
    queryFn: async () => {
      const [contribs, profiles, settings] = await Promise.all([
        supabase.from("contributions").select("*").order("week_of", { ascending: false }).limit(200),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("settings").select("*").eq("id", 1).single(),
      ]);
      const profMap = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name]));
      return {
        rows: (contribs.data ?? []).map((c) => ({ ...c, member_name: profMap.get(c.member_id) ?? "—" })),
        members: profiles.data ?? [],
        settings: settings.data,
      };
    },
  });

  const [form, setForm] = useState({
  member_id: "",
  amount: "",
  penalty_amount: "",
  note: "",
  week_of: lastSunday(),
  paid_on: new Date().toISOString().slice(0, 10),
});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.member_id || !form.amount) return toast.error("Select a member and amount");
    const { error } = await supabase.from("contributions").insert({
  member_id: form.member_id,
  amount: Number(form.amount),
  penalty_amount: Number(form.penalty_amount || 0),
  note: form.note,
  week_of: form.week_of,
  paid_on: form.paid_on,
  recorded_by: user?.id,
});
    if (error) return toast.error(error.message);
    await supabase
      .from("missed_contributions")
      .update({ resolved: true, resolved_on: form.paid_on })
      .eq("member_id", form.member_id)
      .eq("week_of", form.week_of);
    await supabase.from("audit_logs").insert({
      actor_id: user?.id,
      action: "create",
      entity: "contributions",
      after_value: form,
    });
    toast.success("Contribution recorded");
    setOpen(false);
    setForm({
  ...form,
  amount: "",
  penalty_amount: "",
  note: "",
});
    qc.invalidateQueries({ queryKey: ["contributions-all"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  // Open edit dialog
  const openEdit = (r: any) => {
    setEditEntry(r);
    setEditForm({ amount: String(r.amount), week_of: r.week_of, paid_on: r.paid_on });
  };

  // Submit edit
  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEntry) return;
    const { error } = await supabase.from("contributions").update({
      amount: Number(editForm.amount),
      week_of: editForm.week_of,
      paid_on: editForm.paid_on,
    }).eq("id", editEntry.id);
    if (error) return toast.error(error.message);
    toast.success("Contribution updated");
    setEditEntry(null);
    qc.invalidateQueries({ queryKey: ["contributions-all"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("contributions").delete().eq("id", deleteId);
    if (error) return toast.error(error.message);
    toast.success("Contribution deleted");
    setDeleteId(null);
    qc.invalidateQueries({ queryKey: ["contributions-all"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return (
    <div>
      <PageHeader
        title="Contributions"
        description={`Weekly contribution: ${formatINR(data?.settings?.weekly_contribution ?? 50)}`}
        actions={
          isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" /> Record contribution
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Contribution</DialogTitle>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Member</Label>
                    <Select value={form.member_id} onValueChange={(v) => setForm({ ...form, member_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                      <SelectContent>
                        {(data?.members ?? []).map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Week of (Sunday)</Label>
                      <Input type="date" value={form.week_of} onChange={(e) => setForm({ ...form, week_of: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Paid on</Label>
                      <Input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder={String(data?.settings?.weekly_contribution ?? 50)}
                    />
                  </div>
                  <div className="space-y-2">
  <Label>Penalty Amount (₹)</Label>
  <Input
    type="number"
    step="0.01"
    value={form.penalty_amount}
    onChange={(e) =>
      setForm({ ...form, penalty_amount: e.target.value })
    }
    placeholder="0"
  />
</div>

<div className="space-y-2">
  <Label>Note</Label>
  <Input
    value={form.note}
    onChange={(e) =>
      setForm({ ...form, note: e.target.value })
    }
    placeholder="Late payment, missed week, etc."
  />
</div>
                  <DialogFooter>
                    <Button type="submit">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
  <TableRow>
    <TableHead>Member</TableHead>
    <TableHead>Week of</TableHead>
    <TableHead>Paid on</TableHead>
    <TableHead className="text-right">Amount</TableHead>
    <TableHead className="text-right">Penalty</TableHead>
    {isAdmin && <TableHead></TableHead>}
  </TableRow>
</TableHeader>
            <TableBody>
              {(data?.rows ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.member_name}</TableCell>
                  <TableCell>{formatDate(r.week_of)}</TableCell>
                  <TableCell>{formatDate(r.paid_on)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(r.amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">
  {formatINR(r.penalty_amount ?? 0)}
</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteId(r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {data && data.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-8">
                    <PiggyBank className="h-6 w-6 mx-auto mb-2 opacity-40" />
                    No contributions recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editEntry} onOpenChange={(v) => !v && setEditEntry(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Contribution</DialogTitle></DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Week of (Sunday)</Label>
                <Input type="date" value={editForm.week_of} onChange={(e) => setEditForm({ ...editForm, week_of: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Paid on</Label>
                <Input type="date" value={editForm.paid_on} onChange={(e) => setEditForm({ ...editForm, paid_on: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditEntry(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Contribution</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this contribution? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}