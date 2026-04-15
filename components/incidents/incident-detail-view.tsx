"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { remediateIncident, type AuditLogRecord, type IncidentRecord, type RemediationRunRecord, type ServerRecord } from "@/lib/api";

interface IncidentDetailViewProps {
  audits: AuditLogRecord[];
  incident: IncidentRecord;
  remediations: RemediationRunRecord[];
  server: ServerRecord;
}

export function IncidentDetailView({
  audits,
  incident: initialIncident,
  remediations: initialRemediations,
  server,
}: IncidentDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [incident, setIncident] = useState(initialIncident);
  const [remediations, setRemediations] = useState(initialRemediations);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  function handleRemediate(actionType: string) {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await remediateIncident({
          actionType,
          incidentId: incident.id,
        });

        const refreshedIncident = payload.data.incidents.find((item) => item.id === incident.id);

        if (refreshedIncident) {
          setIncident(refreshedIncident);
        }

        setRemediations(
          payload.data.runs.filter((run) => run.incidentId === incident.id),
        );
        setStatusMessage(`Executed allowlisted remediation: ${actionType}`);
        router.refresh();
      } catch (remediationError) {
        setError(
          remediationError instanceof Error
            ? remediationError.message
            : "Unable to execute remediation",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Incident Detail
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{incident.title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {incident.summary ?? "No summary"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          className="rounded-full border border-border bg-white/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          href={`/servers/${server.id}`}
        >
          Open server
        </a>
        <a
          className="rounded-full border border-border bg-white/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          href="/incidents"
        >
          Back to queue
        </a>
      </div>

      {statusMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {statusMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

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
            {incident.status === "open" ? (
              incident.remediation.allowedActions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {incident.remediation.allowedActions.map((action) => (
                    <Button
                      disabled={isPending}
                      key={action.actionType}
                      onClick={() => handleRemediate(action.actionType)}
                      type="button"
                      variant={action.provider === "linode" ? "primary" : "secondary"}
                    >
                      {action.title}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {incident.remediation.reasons[0] ?? "No allowlisted remediations are available."}
                </p>
              )
            ) : incident.status === "remediation_pending" ? (
              <p className="mt-2 text-sm text-amber-700">
                Remediation completed. Waiting for a healthy follow-up check before resolution.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                This incident is resolved.
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
          <a
            className="inline-flex rounded-full border border-border px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            href={`/servers/${server.id}`}
          >
            Open server detail
          </a>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card id="incident-remediations" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Remediation history</h2>
            <p className="mt-1 text-sm text-muted-foreground">Source run history for this incident.</p>
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
                <a
                  className="block rounded-2xl border border-border bg-white/80 p-3 text-sm text-foreground transition hover:border-primary/40 hover:bg-white"
                  href={`/servers/${server.id}?kind=audit&eventType=${encodeURIComponent(audit.eventType)}#activity-feed`}
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
                      open in activity
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {new Date(audit.createdAt).toLocaleString()}
                  </div>
                </a>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
