import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/")({ component: IndexRedirect });

function IndexRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    navigate({ to: user ? "/dashboard" : "/login", replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
          <Wallet className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-display text-lg">FundVault</span>
      </div>
    </div>
  );
}
