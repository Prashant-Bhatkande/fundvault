export function formatINR(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "₹0";
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function normalizePhone(raw: string): string {
  return raw.replace(/\D+/g, "");
}

export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@fundvault.app`;
}
