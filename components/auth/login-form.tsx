import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function LoginForm() {
  return (
    <Card className="w-full max-w-md space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Internal Access
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Sign in to the maintenance console
        </h1>
        <p className="text-sm text-muted-foreground">
          Use your admin credentials to review incidents, provider matches, and SSH onboarding.
        </p>
      </div>

      <form className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">Email</span>
          <input
            className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-primary"
            placeholder="ops@example.com"
            type="email"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">Password</span>
          <input
            className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-primary"
            placeholder="••••••••••••"
            type="password"
          />
        </label>

        <Button className="w-full" type="submit">
          Sign In
        </Button>
      </form>

      <div className="rounded-2xl border border-dashed border-border bg-accent/60 p-4 text-sm text-muted-foreground">
        Session and credential handling are still scaffold-only in this pass. The page is ready for the real auth flow.
      </div>
    </Card>
  );
}
