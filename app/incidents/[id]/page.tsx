import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getIncident } from "@/lib/api";

interface IncidentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();

  try {
    const payload = await getIncident(id, {
      cookie: cookieStore.toString(),
    });

    const { incident, server, audits, remediations } = payload.data;

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Incident Detail
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {incident.title}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {incident.summary ?? "No summary"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-full border border-border bg-white/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            href={`/servers/${server.id}`}
          >
            Open server
          </Link>
          <Link
            className="rounded-full border border-border bg-white/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            href="/incidents"
          >
            Back to queue
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card id="incident-overview" className="space-y-3 xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Overview</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The incident record and its policy-approved remediation state.
                </p>
              </div>
              <div className="rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {incident.severity} • {incident.status}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-foreground">
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Opened</div>
                <div className="mt-2">{new Date(incident.openedAt).toLocaleString()}</div>
              </div>
              <div className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-foreground">
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Source check</div>
                <div className="mt-2">{incident.checkType ?? "Unknown"}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-foreground">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Allowed remediations
              </div>
              {incident.remediation.allowedActions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {incident.remediation.allowedActions.map((action) => (
                    <span
                      className="rounded-full border border-border px-3 py-1 text-xs text-foreground"
                      key={action.actionType}
                    >
                      {action.title}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {incident.remediation.reasons[0] ?? "No allowlisted remediations are available."}
                </p>
              )}
            </div>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Server</h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="text-foreground">{server.name}</p>
              <p>{server.hostname}</p>
              <p>{server.environment}</p>
              <p>{server.onboardingStatus}</p>
            </div>
            <Link
              className="inline-flex rounded-full border border-border px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              href={`/servers/${server.id}`}
            >
              Open server detail
            </Link>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card id="incident-remediations" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Remediation history</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Source run history for this incident.
              </p>
            </div>
            <div className="space-y-2">
              {remediations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No remediation runs recorded.</p>
              ) : (
                remediations.map((run) => (
                  <div
                    className="rounded-2xl border border-border bg-white/80 p-3 text-sm text-foreground"
                    id={`remediation-${run.id}`}
                    key={run.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium">{run.actionType}</div>
                        <div className="text-muted-foreground">
                          {run.outputSnippet ?? run.commandText ?? "No output"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {run.provider} • {run.status} • {new Date(run.startedAt).toLocaleString()}
                        </div>
                      </div>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        source
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card id="incident-audit" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Audit trail</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Policy and operator events attached to this incident.
              </p>
            </div>
            <div className="space-y-2">
              {audits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit log entries recorded.</p>
              ) : (
                audits.map((audit) => (
                  <div
                    className="rounded-2xl border border-border bg-white/80 p-3 text-sm text-foreground"
                    id={`audit-${audit.id}`}
                    key={audit.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium">{audit.eventType}</div>
                        <div className="text-muted-foreground">
                          {audit.actorType}
                          {audit.actorId ? ` • ${audit.actorId}` : ""}
                        </div>
                      </div>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        audit
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {new Date(audit.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof Error && /authentication is required|session was not valid/i.test(error.message)) {
      redirect("/login");
    }

    if (error instanceof Error && /incident record was not found/i.test(error.message)) {
      notFound();
    }

    throw error;
  }
}
