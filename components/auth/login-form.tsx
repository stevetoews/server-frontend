"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { login } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await login({ email, password });
        router.push("/dashboard");
        router.refresh();
      } catch (submissionError) {
        setError(
          submissionError instanceof Error
            ? submissionError.message
            : "Unable to sign in",
        );
      }
    });
  }

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
          Use your admin credentials to manage WordOps servers, incidents, and SSH onboarding.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">Email</span>
          <input
            className="h-12 w-full rounded-xl border border-border bg-background/70 px-4 text-sm text-foreground outline-none ring-0 transition focus:border-primary"
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect="off"
            placeholder="ops@example.com"
            required
            type="email"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">Password</span>
          <input
            className="h-12 w-full rounded-xl border border-border bg-background/70 px-4 text-sm text-foreground outline-none ring-0 transition focus:border-primary"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="••••••••••••"
            required
            type="password"
            spellCheck={false}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/12 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <Button className="w-full" disabled={isPending} type="submit">
          {isPending ? "Signing In..." : "Sign In"}
        </Button>
      </form>

      <div className="rounded-xl border border-dashed border-border bg-accent/45 p-4 text-sm text-muted-foreground">
        The backend now supports bootstrap admin login with an HTTP-only session cookie.
      </div>
    </Card>
  );
}
