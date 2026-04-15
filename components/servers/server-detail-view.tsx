"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  activateServer,
  getServerActivity,
  getServerChecks,
  getServerIncidents,
  getServerRemediations,
  getSpinupwpCandidates,
  mapSpinupwpServer,
  remediateIncident,
  runServerChecks,
  type HealthCheckRecord,
  type IncidentRecord,
  type PaginationMeta,
  type RemediationRunRecord,
  type ServerRecord,
  type SpinupwpServerCandidate,
  type ServerActivityItem,
} from "@/lib/api";

const DETAIL_PAGE_SIZE = 5;
const ACTIVITY_KIND_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Audit", value: "audit" },
  { label: "Incidents", value: "incident" },
  { label: "Remediations", value: "remediation" },
] as const;
const SECTION_LINKS = [
  { href: "#onboarding-state", label: "Onboarding" },
  { href: "#recent-checks", label: "Checks" },
  { href: "#server-incidents", label: "Incidents" },
  { href: "#remediation-runs", label: "Remediations" },
  { href: "#activity-feed", label: "Activity" },
] as const;

interface ServerDetailViewProps {
  initialActivityEventType: string;
  initialActivityKindFilter: ActivityKindFilter;
  initialActivity: ServerActivityItem[];
  initialActivityPagination: PaginationMeta | null;
  server: ServerRecord;
}

type ActivityKindFilter = "all" | "audit" | "incident" | "remediation";

function getActivitySourceHref(entry: ServerActivityItem) {
  if (entry.kind === "incident") {
    return `/incidents/${entry.payload.id}`;
  }

  if (entry.kind === "remediation") {
    return `/incidents/${entry.payload.incidentId}#remediation-${entry.payload.id}`;
  }

  if (entry.payload.targetType === "incident" && entry.payload.targetId) {
    return `/incidents/${entry.payload.targetId}`;
  }

  if (entry.payload.targetType === "server") {
    return "#onboarding-state";
  }

  return "#activity-feed";
}

export function ServerDetailView({
  initialActivityEventType,
  initialActivityKindFilter,
  initialActivity,
  initialActivityPagination,
  server,
}: ServerDetailViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [spinupwpCandidates, setSpinupwpCandidates] = useState<SpinupwpServerCandidate[]>([]);
  const [selectedSpinupwpServerId, setSelectedSpinupwpServerId] = useState<string>(
    server.spinupwpServerId ?? "",
  );
  const [checks, setChecks] = useState<HealthCheckRecord[]>([]);
  const [checksPagination, setChecksPagination] = useState<PaginationMeta | null>(null);
  const [checksOffset, setChecksOffset] = useState(0);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [incidentsPagination, setIncidentsPagination] = useState<PaginationMeta | null>(null);
  const [incidentsOffset, setIncidentsOffset] = useState(0);
  const [runs, setRuns] = useState<RemediationRunRecord[]>([]);
  const [runsPagination, setRunsPagination] = useState<PaginationMeta | null>(null);
  const [runsOffset, setRunsOffset] = useState(0);
  const [activity, setActivity] = useState<ServerActivityItem[]>(initialActivity);
  const [activityPagination, setActivityPagination] =
    useState<PaginationMeta | null>(initialActivityPagination);
  const [activityKindFilter, setActivityKindFilter] =
    useState<ActivityKindFilter>(initialActivityKindFilter);
  const [activityEventType, setActivityEventType] = useState(initialActivityEventType);
  const [appliedActivityKindFilter, setAppliedActivityKindFilter] =
    useState<ActivityKindFilter>(initialActivityKindFilter);
  const [appliedActivityEventType, setAppliedActivityEventType] =
    useState(initialActivityEventType);
  const [activityOffset, setActivityOffset] = useState(0);

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

  function loadChecks(offset = checksOffset) {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await getServerChecks(server.id, {
          limit: DETAIL_PAGE_SIZE,
          offset,
        });
        setChecks(payload.data.checks);
        setChecksPagination(payload.data.pagination ?? null);
        setChecksOffset(offset);
      } catch (checkError) {
        setError(
          checkError instanceof Error
            ? checkError.message
            : "Unable to load recent checks",
        );
      }
    });
  }

  function loadIncidents(offset = incidentsOffset) {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await getServerIncidents(server.id, {
          limit: DETAIL_PAGE_SIZE,
          offset,
        });
        setIncidents(payload.data.incidents);
        setIncidentsPagination(payload.data.pagination ?? null);
        setIncidentsOffset(offset);
      } catch (incidentError) {
        setError(
          incidentError instanceof Error
            ? incidentError.message
            : "Unable to load incidents",
        );
      }
    });
  }

  function loadRuns(offset = runsOffset) {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await getServerRemediations(server.id, {
          limit: DETAIL_PAGE_SIZE,
          offset,
        });
        setRuns(payload.data.runs);
        setRunsPagination(payload.data.pagination ?? null);
        setRunsOffset(offset);
      } catch (runError) {
        setError(
          runError instanceof Error ? runError.message : "Unable to load remediation runs",
        );
      }
    });
  }

  function loadActivity(
      offset = activityOffset,
      filters?: {
      eventType?: string;
      kind?: ActivityKindFilter;
    },
  ) {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const kind = filters?.kind ?? appliedActivityKindFilter;
        const eventType = filters?.eventType ?? appliedActivityEventType;
        const payload = await getServerActivity(server.id, {
          limit: DETAIL_PAGE_SIZE,
          offset,
          ...(kind !== "all" ? { kind } : {}),
          ...(eventType ? { eventType } : {}),
        });
        setActivity(payload.data.items);
        setActivityPagination(payload.data.pagination ?? null);
        setActivityOffset(offset);
      } catch (activityError) {
        setError(
          activityError instanceof Error ? activityError.message : "Unable to load activity",
        );
      }
    });
  }

  function updateActivityRoute(filters: {
    eventType?: string;
    kind: ActivityKindFilter;
  }) {
    const params = new URLSearchParams();

    if (filters.kind !== "all") {
      params.set("kind", filters.kind);
    }

    if (filters.eventType) {
      params.set("eventType", filters.eventType);
    }

    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
      scroll: false,
    });
  }

  function handleApplyActivityFilters() {
    const normalizedEventType = activityEventType.trim();
    const nextFilters = {
      kind: activityKindFilter,
      eventType: normalizedEventType,
    };

    setAppliedActivityKindFilter(nextFilters.kind);
    setAppliedActivityEventType(nextFilters.eventType);
    setActivityEventType(nextFilters.eventType);
    updateActivityRoute(nextFilters);
    loadActivity(0, nextFilters);
  }

  function handleClearActivityFilters() {
    const nextFilters = {
      kind: "all" as ActivityKindFilter,
      eventType: "",
    };

    setActivityKindFilter(nextFilters.kind);
    setActivityEventType(nextFilters.eventType);
    setAppliedActivityKindFilter(nextFilters.kind);
    setAppliedActivityEventType(nextFilters.eventType);
    updateActivityRoute(nextFilters);
    loadActivity(0, nextFilters);
  }

  function handleRunChecks() {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await runServerChecks(server.id);
        setChecks(payload.data.checks);
        setChecksPagination(null);
        setChecksOffset(0);
        setStatusMessage("Deterministic checks ran successfully for this server.");

        const incidentsPayload = await getServerIncidents(server.id, {
          limit: DETAIL_PAGE_SIZE,
          offset: 0,
        });
        setIncidents(incidentsPayload.data.incidents);
        setIncidentsPagination(incidentsPayload.data.pagination ?? null);
        setIncidentsOffset(0);
      } catch (checkError) {
        setError(
          checkError instanceof Error
            ? checkError.message
            : "Unable to run deterministic checks",
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

  useEffect(() => {
    loadChecks(0);
    loadIncidents(0);
    loadRuns(0);
    loadActivity(0);
    // Load the default server detail slices on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id]);

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

      <div className="flex flex-wrap gap-2">
        {SECTION_LINKS.map((link) => (
          <a
            className="rounded-full border border-border bg-white/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            href={link.href}
            key={link.href}
          >
            {link.label}
          </a>
        ))}
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

          <div
            id="onboarding-state"
            className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-foreground"
          >
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

          <div id="recent-checks" className="border-t border-border pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Recent Checks
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {checksPagination ? (
                    <span>
                      Showing {checksPagination.offset + 1}-{checksPagination.offset + checksPagination.returned} of{" "}
                      {checksPagination.total}
                    </span>
                  ) : (
                    <span>Latest checks for this server</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button disabled={isPending} onClick={() => loadChecks(0)} type="button" variant="secondary">
                  Refresh
                </Button>
                <Button disabled={isPending || !server.spinupwpServerId} onClick={handleRunChecks} type="button">
                  Run Checks Now
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {checks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent checks loaded yet.
                </p>
              ) : (
                checks.map((check) => (
                  <div
                    className="rounded-2xl border border-border bg-white/80 p-3 text-sm text-foreground"
                    key={check.id}
                  >
                    <div className="font-medium">{check.checkType}</div>
                    <div className="text-muted-foreground">{check.summary}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {check.status} • {new Date(check.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            {checksPagination ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div>
                  <span>{checksPagination.hasMore ? "More checks available" : "End of checks"}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={isPending || checksOffset === 0}
                    onClick={() => loadChecks(Math.max(0, checksOffset - DETAIL_PAGE_SIZE))}
                    type="button"
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={isPending || !checksPagination.hasMore}
                    onClick={() => loadChecks(checksOffset + DETAIL_PAGE_SIZE)}
                    type="button"
                    variant="secondary"
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div id="server-incidents" className="border-t border-border pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Incidents
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {incidentsPagination ? (
                    <span>
                      Showing {incidentsPagination.offset + 1}-
                      {incidentsPagination.offset + incidentsPagination.returned} of{" "}
                      {incidentsPagination.total}
                    </span>
                  ) : (
                    <span>Latest incidents for this server</span>
                  )}
                </div>
              </div>

              <Button
                disabled={isPending}
                onClick={() => loadIncidents(0)}
                type="button"
                variant="secondary"
              >
                Refresh
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No incidents loaded yet.
                </p>
              ) : (
                incidents.map((incident) => (
                  <div
                    className="rounded-2xl border border-border bg-white/80 p-3 text-sm text-foreground"
                    key={incident.id}
                    id={`incident-${incident.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium">{incident.title}</div>
                        <div className="text-muted-foreground">
                          {incident.summary ?? "No summary"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {incident.severity} • {incident.status} •{" "}
                          {new Date(incident.openedAt).toLocaleString()}
                        </div>
                      </div>
                      <a
                        className="rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                        href={`/incidents/${incident.id}`}
                      >
                        Source
                      </a>
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

            {incidentsPagination ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div>
                  <span>{incidentsPagination.hasMore ? "More incidents available" : "End of incidents"}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={isPending || incidentsOffset === 0}
                    onClick={() => loadIncidents(Math.max(0, incidentsOffset - DETAIL_PAGE_SIZE))}
                    type="button"
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={isPending || !incidentsPagination.hasMore}
                    onClick={() => loadIncidents(incidentsOffset + DETAIL_PAGE_SIZE)}
                    type="button"
                    variant="secondary"
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div id="remediation-runs" className="border-t border-border pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Remediation Runs
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {runsPagination ? (
                    <span>
                      Showing {runsPagination.offset + 1}-{runsPagination.offset + runsPagination.returned} of{" "}
                      {runsPagination.total}
                    </span>
                  ) : (
                    <span>Latest remediation runs for this server</span>
                  )}
                </div>
              </div>

              <Button disabled={isPending} onClick={() => loadRuns(0)} type="button" variant="secondary">
                Refresh
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No remediation runs loaded yet.
                </p>
              ) : (
                runs.map((run) => (
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
                      <a
                        className="rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                        href={`/incidents/${run.incidentId}#remediation-${run.id}`}
                      >
                        Source
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>

            {runsPagination ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div>
                  <span>{runsPagination.hasMore ? "More runs available" : "End of remediation history"}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={isPending || runsOffset === 0}
                    onClick={() => loadRuns(Math.max(0, runsOffset - DETAIL_PAGE_SIZE))}
                    type="button"
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={isPending || !runsPagination.hasMore}
                    onClick={() => loadRuns(runsOffset + DETAIL_PAGE_SIZE)}
                    type="button"
                    variant="secondary"
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div id="activity-feed" className="border-t border-border pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Activity Feed
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {activityPagination ? (
                    <span>
                      Showing {activityPagination.offset + 1}-
                      {activityPagination.offset + activityPagination.returned} of{" "}
                      {activityPagination.total}
                      {appliedActivityKindFilter !== "all" || appliedActivityEventType
                        ? ` • filtered by ${[
                            appliedActivityKindFilter !== "all" ? appliedActivityKindFilter : null,
                            appliedActivityEventType || null,
                          ]
                            .filter(Boolean)
                            .join(" / ")}`
                        : ""}
                    </span>
                  ) : (
                    <span>Chronological server activity</span>
                  )}
                </div>
              </div>

              <Button
                disabled={isPending}
                onClick={() => loadActivity(0)}
                type="button"
                variant="secondary"
              >
                Refresh
              </Button>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-white/70 p-4 lg:grid-cols-[180px_minmax(0,1fr)_auto_auto]">
              <label className="space-y-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Kind
                <select
                  className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal uppercase tracking-normal text-foreground"
                  onChange={(event) => setActivityKindFilter(event.target.value as ActivityKindFilter)}
                  value={activityKindFilter}
                >
                  {ACTIVITY_KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Event type
                <input
                  className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground"
                  onChange={(event) => setActivityEventType(event.target.value)}
                  placeholder="e.g. restart.nginx"
                  value={activityEventType}
                />
              </label>

              <div className="flex items-end">
                <Button disabled={isPending} onClick={handleApplyActivityFilters} type="button">
                  Apply
                </Button>
              </div>

              <div className="flex items-end">
                <Button disabled={isPending} onClick={handleClearActivityFilters} type="button" variant="secondary">
                  Clear
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {appliedActivityKindFilter !== "all" || appliedActivityEventType
                    ? "No activity matched the current filters."
                    : "No activity loaded yet."}
                </p>
              ) : (
                activity.map((entry) => (
                  <a
                    className="block rounded-2xl border border-border bg-white/80 p-3 text-sm text-foreground transition hover:border-primary/40 hover:bg-white"
                    href={getActivitySourceHref(entry)}
                    id={`activity-${entry.id}`}
                    key={entry.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {entry.kind === "audit"
                            ? entry.payload.eventType
                            : entry.kind === "incident"
                              ? entry.payload.title
                              : entry.payload.actionType}
                        </div>
                        <div className="text-muted-foreground">
                          {entry.kind === "audit"
                            ? `${entry.payload.actorType} • ${entry.payload.actorId}`
                            : entry.kind === "incident"
                              ? entry.payload.summary ?? "Incident opened"
                              : entry.payload.outputSnippet ??
                                entry.payload.commandText ??
                                "Remediation run"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                          {entry.kind}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          Open source
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </a>
                ))
              )}
            </div>

            {activityPagination ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div>
                  <span>{activityPagination.hasMore ? "More activity available" : "End of activity"}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={isPending || activityOffset === 0}
                    onClick={() => loadActivity(Math.max(0, activityOffset - DETAIL_PAGE_SIZE))}
                    type="button"
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={isPending || !activityPagination.hasMore}
                    onClick={() => loadActivity(activityOffset + DETAIL_PAGE_SIZE)}
                    type="button"
                    variant="secondary"
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
