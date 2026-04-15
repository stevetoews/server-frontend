"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  activateServer,
  getServerChecks,
  getServerIncidents,
  getServerRemediations,
  getSpinupwpCandidates,
  mapSpinupwpServer,
  remediateIncident,
  runServerChecks,
  type HealthCheckRecord,
  type IncidentRecord,
  type RemediationRunRecord,
  type ServerRecord,
  type SpinupwpServerCandidate,
} from "@/lib/api";

interface ServerDetailViewProps {
  server: ServerRecord;
}

export function ServerDetailView({ server }: ServerDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [spinupwpCandidates, setSpinupwpCandidates] = useState<SpinupwpServerCandidate[]>([]);
  const [selectedSpinupwpServerId, setSelectedSpinupwpServerId] = useState<string>(
    server.spinupwpServerId ?? "",
  );
  const [checks, setChecks] = useState<HealthCheckRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [runs, setRuns] = useState<RemediationRunRecord[]>([]);

  function handleConfirmProviderMatch() {
    if (!server.providerMatch) {
      return;
    }

    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await activateServer({
          serverId: server.id,
          providerInstanceId: server.providerMatch!.providerInstanceId,
          providerKind: server.providerMatch!.providerKind,
        });

        setStatusMessage(payload.data.nextStep);
        router.refresh();
      } catch (activationError) {
        setError(
          activationError instanceof Error
            ? activationError.message
            : "Unable to confirm provider match",
        );
      }
    });
  }

  function handleLoadSpinupwpCandidates() {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await getSpinupwpCandidates(server.id);
        setSpinupwpCandidates(payload.data.candidates);

        if (!selectedSpinupwpServerId && payload.data.candidates[0]) {
          setSelectedSpinupwpServerId(payload.data.candidates[0].spinupwpServerId);
        }
      } catch (candidateError) {
        setError(
          candidateError instanceof Error
            ? candidateError.message
            : "Unable to load SpinupWP candidates",
        );
      }
    });
  }

  function handleMapSpinupwpServer() {
    if (!selectedSpinupwpServerId) {
      setError("Select a SpinupWP server before mapping.");
      return;
    }

    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await mapSpinupwpServer({
          serverId: server.id,
          spinupwpServerId: selectedSpinupwpServerId,
        });

        setStatusMessage(payload.data.nextStep);
        router.refresh();
      } catch (mappingError) {
        setError(
          mappingError instanceof Error
            ? mappingError.message
            : "Unable to map SpinupWP server",
        );
      }
    });
  }

  function handleLoadChecks() {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await getServerChecks(server.id);
        setChecks(payload.data.checks);
      } catch (checkError) {
        setError(
          checkError instanceof Error
            ? checkError.message
            : "Unable to load recent checks",
        );
      }
    });
  }

  function handleRunChecks() {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await runServerChecks(server.id);
        setChecks(payload.data.checks);
        setStatusMessage("Deterministic checks ran successfully for this server.");

        const incidentsPayload = await getServerIncidents(server.id);
        setIncidents(incidentsPayload.data.incidents);
      } catch (checkError) {
        setError(
          checkError instanceof Error
            ? checkError.message
            : "Unable to run deterministic checks",
        );
      }
    });
  }

  function handleLoadRemediations() {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await getServerRemediations(server.id);
        setRuns(payload.data.runs);
      } catch (runError) {
        setError(
          runError instanceof Error ? runError.message : "Unable to load remediation runs",
        );
      }
    });
  }

  function handleLoadIncidents() {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await getServerIncidents(server.id);
        setIncidents(payload.data.incidents);
      } catch (incidentError) {
        setError(
          incidentError instanceof Error
            ? incidentError.message
            : "Unable to load incidents",
        );
      }
    });
  }

  function handleRemediateIncident(incidentId: string, actionType: string) {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await remediateIncident({
          incidentId,
          actionType,
        });
        setIncidents(payload.data.incidents);
        setRuns(payload.data.runs);
        setStatusMessage(`Executed allowlisted remediation: ${actionType}`);
      } catch (runError) {
        setError(
          runError instanceof Error ? runError.message : "Unable to execute remediation",
        );
      }
    });
  }

  const canConfirmProvider =
    Boolean(server.providerMatch) &&
    server.onboardingStatus !== "active" &&
    server.onboardingStatus !== "provider_matched";
  const canLoadSpinupwp = server.onboardingStatus === "active";
  const canMapSpinupwp = canLoadSpinupwp && Boolean(selectedSpinupwpServerId);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Server Detail
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{server.name}</h1>
        <p className="text-sm text-muted-foreground">
          {server.hostname} • {server.environment} • onboarding status: {server.onboardingStatus}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="space-y-4 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Onboarding state</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirm the provider match to unlock activation and the next SpinupWP mapping step.
              </p>
            </div>

            <Button
              disabled={!canConfirmProvider || isPending}
              onClick={handleConfirmProviderMatch}
              type="button"
            >
              {isPending ? "Confirming..." : "Confirm Provider Match"}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-foreground">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">SSH</div>
              <div className="mt-2">
                {server.sshUsername}@{server.ipAddress ?? server.hostname}:{server.sshPort}
              </div>
              <div className="mt-1 text-muted-foreground">Mode: {server.sshAuthMode}</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-foreground">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Provider Gate
              </div>
              <div className="mt-2">
                {server.providerMatch
                  ? `${server.providerMatch.providerKind} matched`
                  : "Awaiting provider confirmation"}
              </div>
              <div className="mt-1 text-muted-foreground">
                {server.providerMatch
                  ? server.providerMatch.providerInstanceId
                  : "SpinupWP mapping stays disabled until this is confirmed."}
              </div>
            </div>
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

          {server.notes ? (
            <div className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-foreground">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Notes
              </div>
              <div className="mt-2">{server.notes}</div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-foreground">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  SpinupWP Mapping
                </div>
                <div className="mt-2">
                  {server.spinupwpServerId
                    ? `Mapped to ${server.spinupwpServerId}`
                    : "Not mapped yet"}
                </div>
                <div className="mt-1 text-muted-foreground">
                  This unlocks only after the primary provider is confirmed and the server is active.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!canLoadSpinupwp || isPending}
                  onClick={handleLoadSpinupwpCandidates}
                  type="button"
                  variant="secondary"
                >
                  Load SpinupWP Servers
                </Button>
                <Button
                  disabled={!canMapSpinupwp || isPending}
                  onClick={handleMapSpinupwpServer}
                  type="button"
                >
                  Map SpinupWP Server
                </Button>
              </div>
            </div>

            {spinupwpCandidates.length > 0 ? (
              <div className="mt-4 space-y-3">
                <select
                  className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm"
                  onChange={(event) => setSelectedSpinupwpServerId(event.target.value)}
                  value={selectedSpinupwpServerId}
                >
                  <option value="" disabled>
                    Select a SpinupWP server
                  </option>
                  {spinupwpCandidates.map((candidate) => (
                    <option
                      key={candidate.spinupwpServerId}
                      value={candidate.spinupwpServerId}
                    >
                      {candidate.label} ({candidate.siteCount} sites)
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Timeline</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>Created: {new Date(server.createdAt).toLocaleString()}</li>
            <li>Updated: {new Date(server.updatedAt).toLocaleString()}</li>
            <li>
              Primary match:{" "}
              {server.providerMatch
                ? `${server.providerMatch.providerKind} ${Math.round(server.providerMatch.confidence * 100)}%`
                : "pending"}
            </li>
          </ul>

          <div className="border-t border-border pt-3">
            <div className="flex flex-wrap gap-2">
              <Button disabled={isPending} onClick={handleLoadChecks} type="button" variant="secondary">
                Load Recent Checks
              </Button>
              <Button disabled={isPending || !server.spinupwpServerId} onClick={handleRunChecks} type="button">
                Run Checks Now
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {checks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent checks loaded yet.
                </p>
              ) : (
                checks.map((check) => (
                  <div className="rounded-2xl border border-border bg-white/80 p-3 text-sm text-foreground" key={check.id}>
                    <div className="font-medium">{check.checkType}</div>
                    <div className="text-muted-foreground">{check.summary}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {check.status} • {new Date(check.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isPending}
                onClick={handleLoadIncidents}
                type="button"
                variant="secondary"
              >
                Load Incidents
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No incidents loaded yet.
                </p>
              ) : (
                incidents.map((incident) => (
                  <div className="rounded-2xl border border-border bg-white/80 p-3 text-sm text-foreground" key={incident.id}>
                    <div className="font-medium">{incident.title}</div>
                    <div className="text-muted-foreground">
                      {incident.summary ?? "No summary"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {incident.severity} • {incident.status} • {new Date(incident.openedAt).toLocaleString()}
                    </div>
                    {incident.status === "open" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {incident.remediation.allowedActions.length > 0 ? (
                          incident.remediation.allowedActions.map((action) => (
                            <Button
                              disabled={isPending}
                              key={action.actionType}
                              onClick={() => handleRemediateIncident(incident.id, action.actionType)}
                              type="button"
                              variant={action.provider === "linode" ? "primary" : "secondary"}
                            >
                              {action.title}
                            </Button>
                          ))
                        ) : (
                          <div className="text-xs text-amber-700">
                            {incident.remediation.reasons[0] ?? "No allowlisted remediations are available for this incident."}
                          </div>
                        )}
                      </div>
                    ) : null}
                    {incident.status === "remediation_pending" ? (
                      <div className="mt-3 text-xs text-amber-700">
                        Remediation completed. Waiting for a healthy follow-up check before resolution.
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex flex-wrap gap-2">
              <Button disabled={isPending} onClick={handleLoadRemediations} type="button" variant="secondary">
                Load Remediation Runs
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No remediation runs loaded yet.
                </p>
              ) : (
                runs.map((run) => (
                  <div className="rounded-2xl border border-border bg-white/80 p-3 text-sm text-foreground" key={run.id}>
                    <div className="font-medium">{run.actionType}</div>
                    <div className="text-muted-foreground">
                      {run.outputSnippet ?? run.commandText ?? "No output"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {run.provider} • {run.status} • {new Date(run.startedAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
