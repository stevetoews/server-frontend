"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createServer, type OnboardingSnapshot } from "@/lib/api";

const steps = [
  "Create server record",
  "Test SSH",
  "Discover host metadata",
  "Detect provider metadata",
  "Activate monitoring",
] as const;

export function AddServerWizard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"production" | "staging" | "development">("production");
  const [hostname, setHostname] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [sshUsername, setSshUsername] = useState("root");
  const [sshAuthMode, setSshAuthMode] = useState<"password" | "passwordless_agent">("password");
  const [sshPassword, setSshPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingSnapshot | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const payload = await createServer({
          name,
          environment,
          hostname,
          sshUsername,
          sshAuthMode,
          ...(sshAuthMode === "password" ? { sshPassword } : {}),
          ...(ipAddress.trim() ? { ipAddress: ipAddress.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });

        setOnboarding(payload.data.onboarding);
        router.push(`/servers/${payload.data.server.id}`);
        router.refresh();
      } catch (submissionError) {
        setError(
          submissionError instanceof Error
            ? submissionError.message
            : "Unable to save server draft",
        );
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Onboarding Flow
          </p>
          <h2 className="text-xl font-semibold text-foreground">Add server</h2>
        </div>

        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li className="flex items-start gap-3" key={step}>
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{step}</p>
                <p className="text-xs text-muted-foreground">
                  {index === 3
                    ? "Akamai or DigitalOcean inventory is read-only context after discovery."
                    : "This step is now driven by the backend onboarding API."}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="space-y-6">
        <Card className="space-y-5">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Add the first live server
            </h1>
            <p className="text-sm text-muted-foreground">
              Store the server, test SSH immediately, discover the host, detect provider metadata, then activate monitoring right away.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Server name</span>
                <input
                  className="h-12 rounded-2xl border border-border bg-white px-4 text-sm"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="wp-prod-01"
                  value={name}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Environment</span>
                <select
                  className="h-12 rounded-2xl border border-border bg-white px-4 text-sm"
                  onChange={(event) =>
                    setEnvironment(event.target.value as "production" | "staging" | "development")
                  }
                  value={environment}
                >
                  <option value="production">production</option>
                  <option value="staging">staging</option>
                  <option value="development">development</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Hostname</span>
                <input
                  className="h-12 rounded-2xl border border-border bg-white px-4 text-sm"
                  onChange={(event) => setHostname(event.target.value)}
                  placeholder="Optional if public IP is provided"
                  value={hostname}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Public IP</span>
                <input
                  className="h-12 rounded-2xl border border-border bg-white px-4 text-sm"
                  onChange={(event) => setIpAddress(event.target.value)}
                  placeholder="203.0.113.10"
                  value={ipAddress}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">SSH user</span>
                <input
                  className="h-12 rounded-2xl border border-border bg-white px-4 text-sm"
                  onChange={(event) => setSshUsername(event.target.value)}
                  placeholder="root"
                  value={sshUsername}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">SSH auth mode</span>
                <select
                  className="h-12 rounded-2xl border border-border bg-white px-4 text-sm"
                  onChange={(event) =>
                    setSshAuthMode(event.target.value as "password" | "passwordless_agent")
                  }
                  value={sshAuthMode}
                >
                  <option value="password">password</option>
                  <option value="passwordless_agent">passwordless_agent</option>
                </select>
              </label>
              {sshAuthMode === "password" ? (
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Root password</span>
                  <input
                    autoComplete="current-password"
                    className="h-12 rounded-2xl border border-border bg-white px-4 text-sm"
                    onChange={(event) => setSshPassword(event.target.value)}
                    placeholder="Stored encrypted on the backend"
                    type="password"
                    value={sshPassword}
                  />
                </label>
              ) : null}
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">Notes</span>
              <textarea
                className="min-h-32 w-full rounded-[1.5rem] border border-border bg-white px-4 py-3 text-sm"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Internal notes, maintenance windows, or escalation context"
                value={notes}
              />
            </label>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button disabled={isPending} type="submit">
                {isPending ? "Testing SSH..." : "Create Server and Test SSH"}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Onboarding result</h2>
          {onboarding ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-foreground">
                SSH latency: {onboarding.ssh.latencyMs}ms. Discovery host: {onboarding.discovery.hostname}. Next step: {onboarding.nextStep}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {onboarding.providerMatches.map((match) => (
                  <div className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-foreground" key={`${match.providerKind}:${match.providerInstanceId}`}>
                    {match.providerKind} candidate: {match.providerInstanceId}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Submit the server to verify SSH, collect host metadata, and load provider candidates from the backend.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
