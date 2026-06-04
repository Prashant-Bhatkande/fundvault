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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, X } from "lucide-react";
import { monthlyInterest } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({ meta: [{ title: "Loans — FundVault" }] }),
  component: LoansPage,
});

function addMonths(date: string, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// ── Request form state ────────────────────────────────────────────────────────
type ReqForm = { amount: string; date: string; purpose: string };
const emptyReq = (): ReqForm => ({ amount: "", date: "", purpose: "" });

// ── Repay form state ──────────────────────────────────────────────────────────
type RepayForm = { principal: string; interest: string; penalty: string };
const emptyRepay = (): RepayForm => ({ principal: "", interest: "", penalty: "" });

function LoansPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  // dialog open state
  const [reqOpen, setReqOpen] = useState(false);
  const [repayLoanId, setRepayLoanId] = useState<string | null>(null);
  const [closeLoanId, setCloseLoanId] = useState<string | null>(null);

  // form values
  const [req, setReq] = useState<ReqForm>(emptyReq());
  const [repay, setRepay] = useState<RepayForm>(emptyRepay());

  // ── approve / reject request (admin) ───────────────────────────────────────
  const [approveReqId, setApproveReqId] = useState<string | null>(null);
  const [approveForm, setApproveForm] = useState({ issuedOn: "", dueOn: "", interestRate: "0.05" });

  const { data } = useQuery({
    queryKey: ["loans-all"],
    queryFn: async () => {
      const [requests, loans, profiles, repays, settings, ips] =
        await Promise.all([
          supabase.from("loan_requests").select("*").order("created_at", { ascending: false }),
          supabase.from("loans").select("*").order("issued_on", { ascending: false }),
          supabase.from("profiles").select("id, full_name"),
          supabase.from("repayments").select("*"),
          supabase.from("settings").select("*").eq("id", 1).single(),
          supabase.from("interest_payments").select("*"),
        ]);

      const profMap = new Map(
        (profiles.data ?? []).map((p) => [p.id, p.full_name])
      );

      const principalPaidMap = new Map<string, number>();
      const interestPaidMap = new Map<string, number>();

      for (const r of repays.data ?? []) {
        principalPaidMap.set(
          r.loan_id,
          (principalPaidMap.get(r.loan_id) ?? 0) + Number(r.principal_paid ?? 0)
        );
        interestPaidMap.set(
          r.loan_id,
          (interestPaidMap.get(r.loan_id) ?? 0) + Number(r.interest_paid ?? 0)
        );
      }

      return {
        requests: (requests.data ?? []).map((r) => ({
          ...r,
          member_name: profMap.get(r.member_id),
        })),
        loans: (loans.data ?? []).map((l) => ({
          ...l,
          member_name: profMap.get(l.member_id),
          principal_repaid: principalPaidMap.get(l.id) ?? 0,
          interest_repaid: interestPaidMap.get(l.id) ?? 0,
        })),
        settings: settings.data,
        ips: ips.data ?? [],
      };
    },
  });

  // ── handlers ────────────────────────────────────────────────────────────────

  const handleRequest = async () => {
    if (!user) return;
    const { error } = await supabase.from("loan_requests").insert({
      member_id: user.id,
      amount: Number(req.amount),
      required_date: req.date,
      purpose: req.purpose,
    });
    if (error) return toast.error(error.message);
    toast.success("Request sent");
    setReqOpen(false);
    setReq(emptyReq());
    qc.invalidateQueries({ queryKey: ["loans-all"] });
  };

  const handleRepay = async () => {
    if (!repayLoanId || !user) return;
    const loan = data?.loans.find((l) => l.id === repayLoanId);
    if (!loan) return;

    const principal = Number(repay.principal || 0);
    const interest = Number(repay.interest || 0);
    const penalty = Number(repay.penalty || 0);

    const { error } = await supabase.from("repayments").insert({
      loan_id: loan.id,
      member_id: loan.member_id,
      principal_paid: principal,
      interest_paid: interest,
      penalty_paid: penalty,
      recorded_by: user.id,
    });
    if (error) return toast.error(error.message);

    // auto-close loan if fully repaid
    if (loan.principal_repaid + principal >= Number(loan.principal)) {
      await supabase
        .from("loans")
        .update({ status: "closed", closed_on: new Date().toISOString().slice(0, 10) })
        .eq("id", loan.id);
    }

    toast.success("Repayment recorded");
    setRepayLoanId(null);
    setRepay(emptyRepay());
    qc.invalidateQueries({ queryKey: ["loans-all"] });
  };

  const handleCloseLoan = async () => {
    if (!closeLoanId) return;
    const { error } = await supabase
      .from("loans")
      .update({ status: "closed", closed_on: new Date().toISOString().slice(0, 10) })
      .eq("id", closeLoanId);
    if (error) return toast.error(error.message);
    toast.success("Loan closed");
    setCloseLoanId(null);
    qc.invalidateQueries({ queryKey: ["loans-all"] });
  };

  const handleApprove = async () => {
    if (!approveReqId) return;
    const req2 = data?.requests.find((r) => r.id === approveReqId);
    if (!req2) return;

    // create loan
    const { error } = await supabase.from("loans").insert({
      member_id: req2.member_id,
      principal: req2.amount,
      issued_on: approveForm.issuedOn,
      due_on: approveForm.dueOn,
      interest_rate_monthly: Number(approveForm.interestRate),
      status: "active",
    });
    if (error) return toast.error(error.message);

    // mark request approved
    await supabase
      .from("loan_requests")
      .update({ status: "approved" })
      .eq("id", approveReqId);

    toast.success("Loan approved");
    setApproveReqId(null);
    qc.invalidateQueries({ queryKey: ["loans-all"] });
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from("loan_requests")
      .update({ status: "rejected" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Request rejected");
    qc.invalidateQueries({ queryKey: ["loans-all"] });
  };

  const interestRate = (data?.settings?.interest_rate_monthly ?? 0.05) * 100;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Loans"
        description={`Interest: ${interestRate.toFixed(2)}% per month`}
        actions={
          <Button onClick={() => setReqOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Request
          </Button>
        }
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>

        {/* ── ACTIVE ── */}
        <TabsContent value="active">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Repaid</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Interest / mo</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.loans ?? [])
                .filter((l) => l.status === "active")
                .map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.member_name}</TableCell>
                    <TableCell>{formatDate(l.issued_on)}</TableCell>
                    <TableCell>{formatDate(l.due_on)}</TableCell>
                    <TableCell>{formatINR(l.principal)}</TableCell>
                    <TableCell>{formatINR(l.principal_repaid)}</TableCell>
                    <TableCell>
                      {formatINR(Number(l.principal) - l.principal_repaid)}
                    </TableCell>
                    <TableCell>
                      {formatINR(
  monthlyInterest(
    Number(l.principal) - l.principal_repaid,
    Number(l.interest_rate_monthly)
  )
)}
                      
                    </TableCell>
                    <TableCell className="flex gap-2">
                      {isAdmin && (
                        <>
                          <Button size="sm" onClick={() => setRepayLoanId(l.id)}>
                            Record
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCloseLoanId(l.id)}
                          >
                            Close
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              {(data?.loans ?? []).filter((l) => l.status === "active").length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    No active loans.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* ── REQUESTS ── */}
        <TabsContent value="requests">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Required by</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead>Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.requests ?? [])
                .filter((r) => r.status === "pending")
                .map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.member_name}</TableCell>
                    <TableCell>{formatINR(r.amount)}</TableCell>
                    <TableCell>{formatDate(r.required_date)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.purpose}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Pending</Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setApproveReqId(r.id);
                            setApproveForm({
                              issuedOn: new Date().toISOString().slice(0, 10),
                              dueOn: addMonths(new Date().toISOString().slice(0, 10), 12),
                              interestRate: String(data?.settings?.interest_rate_monthly ?? 0.05),
                            });
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(r.id)}
                        >
                          <X className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              {(data?.requests ?? []).filter((r) => r.status === "pending").length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-6">
                    No pending requests.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* ── CLOSED ── */}
        <TabsContent value="closed">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Closed on</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Interest paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.loans ?? [])
                .filter((l) => l.status === "closed")
                .map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.member_name}</TableCell>
                    <TableCell>{formatDate(l.issued_on)}</TableCell>
                    <TableCell>{formatDate(l.closed_on)}</TableCell>
                    <TableCell>{formatINR(l.principal)}</TableCell>
                    <TableCell>{formatINR(l.interest_repaid)}</TableCell>
                  </TableRow>
                ))}
              {(data?.loans ?? []).filter((l) => l.status === "closed").length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No closed loans.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* ── REQUEST DIALOG ── */}
      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a Loan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={req.amount}
                onChange={(e) => setReq({ ...req, amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Required by</Label>
              <Input
                type="date"
                value={req.date}
                onChange={(e) => setReq({ ...req, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Purpose</Label>
              <Textarea
                value={req.purpose}
                onChange={(e) => setReq({ ...req, purpose: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReqOpen(false)}>Cancel</Button>
            <Button onClick={handleRequest}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── REPAY DIALOG ── */}
      <Dialog open={!!repayLoanId} onOpenChange={(v) => !v && setRepayLoanId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Repayment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Principal paid (₹)</Label>
              <Input
                type="number"
                value={repay.principal}
                onChange={(e) => setRepay({ ...repay, principal: e.target.value })}
              />
            </div>
            <div>
              <Label>Interest paid (₹)</Label>
              <Input
                type="number"
                value={repay.interest}
                onChange={(e) => setRepay({ ...repay, interest: e.target.value })}
              />
            </div>
            <div>
              <Label>Penalty paid (₹)</Label>
              <Input
                type="number"
                value={repay.penalty}
                onChange={(e) => setRepay({ ...repay, penalty: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepayLoanId(null)}>Cancel</Button>
            <Button onClick={handleRepay}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CLOSE LOAN DIALOG ── */}
      <Dialog open={!!closeLoanId} onOpenChange={(v) => !v && setCloseLoanId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Loan</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Mark this loan as closed? This should only be done when the principal is fully repaid.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseLoanId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleCloseLoan}>Close Loan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── APPROVE DIALOG ── */}
      <Dialog open={!!approveReqId} onOpenChange={(v) => !v && setApproveReqId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Loan Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Issued on</Label>
              <Input
                type="date"
                value={approveForm.issuedOn}
                onChange={(e) => setApproveForm({ ...approveForm, issuedOn: e.target.value })}
              />
            </div>
            <div>
              <Label>Due on</Label>
              <Input
                type="date"
                value={approveForm.dueOn}
                onChange={(e) => setApproveForm({ ...approveForm, dueOn: e.target.value })}
              />
            </div>
            <div>
              <Label>Monthly interest rate (e.g. 0.05 = 5%)</Label>
              <Input
                type="number"
                step="0.01"
                value={approveForm.interestRate}
                onChange={(e) => setApproveForm({ ...approveForm, interestRate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveReqId(null)}>Cancel</Button>
            <Button onClick={handleApprove}>Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}