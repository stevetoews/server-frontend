"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinodeStandardInfo } from "@/components/servers/linode-standard-info";
import {
  getCheckTone,
  getIncidentTone,
  getServerHealthSummary,
  getToneClasses,
} from "@/lib/server-health";
import {
  createServerWordopsSite,
  deleteServerWordopsSite,
  disableServerWordopsSite,
  enableServerWordopsSite,
  getServerActivity,
  getServerChecks,
  getServerIncidents,
  getServerRemediations,
  getServerWordops,
  installServerWordopsStack,
  remediateIncident,
  runServerChecks,
  syncServerWordopsSites,
  type HealthCheckRecord,
  type IncidentRecord,
  type PaginationMeta,
  type RemediationRunRecord,
  type ServerRecord,
  type ServerActivityItem,
  type WordopsOverview,
  type WordopsSiteRecord,
  type WordopsCreateSiteInput,
  type WordopsMutationResult,
} from "@/lib/api";

const DETAIL_PAGE_SIZE = 5;
const ACTIVITY_KIND_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Audit", value: "audit" },
  { label: "Incidents", value: "incident" },
  { label: "Remediations", value: "remediation" },
] as const;
const SECTION_LINKS = [
  { href: "#server-information", label: "Server Info" },
  { href: "#wordops", label: "WordOps" },
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
  initialIncidents: IncidentRecord[];
  initialIncidentsPagination: PaginationMeta | null;
  initialSites: WordopsSiteRecord[];
  initialWordops: WordopsOverview;
  server: ServerRecord;
}

type ActivityKindFilter = "all" | "audit" | "incident" | "remediation";

interface WordopsTerminalState {
  commandText: string;
  output: string;
  status: "running" | "succeeded" | "failed";
  title: string;
}

function buildCreateSiteCommand(input: WordopsCreateSiteInput) {
  const parts = ["wo", "site", "create", input.domain.trim(), `--${input.cacheProfile}`];

  if (input.letsEncrypt) {
    parts.push("--letsencrypt");
  }

  if (input.hsts) {
    parts.push("--hsts");
  }

  if (input.vhostOnly) {
    parts.push("--vhostonly");
  }

  if (input.phpVersion === "8.2") {
    parts.push("--php82");
  }

  if (input.phpVersion === "8.3") {
    parts.push("--php83");
  }

  if (input.adminUser?.trim()) {
    parts.push(`--user=${input.adminUser.trim()}`);
  }

  if (input.adminPassword?.trim()) {
    parts.push("--pass=********");
  }

  if (input.adminEmail?.trim()) {
    parts.push(`--email=${input.adminEmail.trim()}`);
  }

  return parts.join(" ");
}

function applyTerminalResult(
  setTerminal: (value: WordopsTerminalState) => void,
  title: string,
  execution: WordopsMutationResult,
) {
  setTerminal({
    title,
    commandText: execution.commandText,
    output: execution.output,
    status: execution.status,
  });
}

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
    return "#server-information";
  }

  return "#activity-feed";
}

function getActiveIncidentHref(incidents: IncidentRecord[], checkType?: string) {
  if (!checkType) {
    return null;
  }

  const activeIncident = incidents.find(
    (incident) => incident.checkType === checkType && incident.status !== "resolved",
  );

  return activeIncident ? `/incidents/${activeIncident.id}` : null;
}

export function ServerDetailView({
  initialActivityEventType,
  initialActivityKindFilter,
  initialActivity,
  initialActivityPagination,
  initialIncidents,
  initialIncidentsPagination,
  initialSites,
  initialWordops,
  server,
}: ServerDetailViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [wordops, setWordops] = useState<WordopsOverview>(initialWordops);
  const [sites, setSites] = useState<WordopsSiteRecord[]>(initialSites);
  const [terminal, setTerminal] = useState<WordopsTerminalState | null>(null);
  const [siteForm, setSiteForm] = useState<WordopsCreateSiteInput>({
    cacheProfile: "wp",
    domain: "",
    letsEncrypt: true,
  });
  const [checks, setChecks] = useState<HealthCheckRecord[]>([]);
  const [checksPagination, setChecksPagination] = useState<PaginationMeta | null>(null);
  const [checksOffset, setChecksOffset] = useState(0);
  const [incidents, setIncidents] = useState<IncidentRecord[]>(initialIncidents);
  const [incidentsPagination, setIncidentsPagination] =
    useState<PaginationMeta | null>(initialIncidentsPagination);
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
  const providerLabel = server.providerMatch
    ? server.providerMatch.providerKind === "linode"
      ? "Akamai"
      : "DigitalOcean"
    : "Unmatched";
  const serverHealth = getServerHealthSummary(server, incidents);
  const displayedSites = sites.length > 0 ? sites : wordops.sites;
  const wordopsTone =
    wordops.status === "ready"
      ? "good"
      : wordops.status === "missing" || wordops.status === "degraded"
        ? "warn"
        : "danger";
  const wordopsReady = wordops.status === "ready";
  const wordopsStatusLabel =
    wordops.status === "missing"
      ? "Not Found"
      : wordops.status === "degraded"
        ? "Stack Incomplete"
        : wordops.status === "ready"
          ? "Ready"
          : "Error";

  function handleRefreshWordops() {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await getServerWordops(server.id);
        setWordops(payload.data.overview);
        setStatusMessage("WordOps status refreshed from the live server.");
      } catch (wordopsError) {
        setError(
          wordopsError instanceof Error
            ? wordopsError.message
            : "Unable to load WordOps status",
        );
      }
    });
  }

  function handleSyncWordopsSites() {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const payload = await syncServerWordopsSites(server.id);
        setWordops(payload.data.overview);
        setSites(payload.data.sites);
        setStatusMessage(`Synced ${payload.data.sites.length} WordOps site(s).`);
      } catch (syncError) {
        setError(
          syncError instanceof Error
            ? syncError.message
            : "Unable to sync WordOps sites",
        );
      }
    });
  }

  function handleInstallWordopsStack() {
    setError(null);
    setStatusMessage(null);
    setTerminal({
      title: "Install Web Stack",
      commandText: "wo stack install --web",
      output: "Executing WordOps web stack installation...",
      status: "running",
    });

    startTransition(async () => {
      try {
        const payload = await installServerWordopsStack(server.id, {
          profile: "web",
        });
        setWordops(payload.data.overview);
        setSites(payload.data.sites);
        applyTerminalResult(setTerminal, "Install Web Stack", payload.data.execution);
        setStatusMessage("WordOps web stack installed and synced.");
      } catch (stackError) {
        setTerminal({
          title: "Install Web Stack",
          commandText: "wo stack install --web",
          output: stackError instanceof Error ? stackError.message : "Unable to install the WordOps web stack",
          status: "failed",
        });
        setError(
          stackError instanceof Error
            ? stackError.message
            : "Unable to install the WordOps web stack",
        );
      }
    });
  }

  function handleCreateWordopsSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);
    const pendingCommand = buildCreateSiteCommand(siteForm);
    setTerminal({
      title: "Create Site",
      commandText: pendingCommand,
      output: "Executing WordOps site creation...",
      status: "running",
    });

    startTransition(async () => {
      try {
        const payload = await createServerWordopsSite(server.id, {
          ...siteForm,
          domain: siteForm.domain.trim(),
          ...(siteForm.adminEmail?.trim() ? { adminEmail: siteForm.adminEmail.trim() } : {}),
          ...(siteForm.adminPassword?.trim()
            ? { adminPassword: siteForm.adminPassword.trim() }
            : {}),
          ...(siteForm.adminUser?.trim() ? { adminUser: siteForm.adminUser.trim() } : {}),
        });
        setWordops(payload.data.overview);
        setSites(payload.data.sites);
        applyTerminalResult(setTerminal, "Create Site", payload.data.execution);
        setSiteForm({
          cacheProfile: "wp",
          domain: "",
          letsEncrypt: true,
        });
        setStatusMessage(`Created WordOps site ${payload.data.sites[payload.data.sites.length - 1]?.domain ?? siteForm.domain}.`);
      } catch (siteError) {
        setTerminal({
          title: "Create Site",
          commandText: pendingCommand,
          output: siteError instanceof Error ? siteError.message : "Unable to create WordOps site",
          status: "failed",
        });
        setError(
          siteError instanceof Error ? siteError.message : "Unable to create WordOps site",
        );
      }
    });
  }

  function handleMutateWordopsSite(domain: string, action: "enable" | "disable" | "delete") {
    setError(null);
    setStatusMessage(null);
    const commandText =
      action === "enable"
        ? `wo site enable ${domain}`
        : action === "disable"
          ? `wo site disable ${domain}`
          : `wo site delete ${domain} --no-prompt`;
    setTerminal({
      title: `${action === "delete" ? "Delete" : action === "enable" ? "Enable" : "Disable"} Site`,
      commandText,
      output: `Executing WordOps site ${action}...`,
      status: "running",
    });

    startTransition(async () => {
      try {
        const payload =
          action === "enable"
            ? await enableServerWordopsSite(server.id, domain)
            : action === "disable"
              ? await disableServerWordopsSite(server.id, domain)
              : await deleteServerWordopsSite(server.id, domain);

        setWordops(payload.data.overview);
        setSites(payload.data.sites);
        applyTerminalResult(
          setTerminal,
          `${action === "delete" ? "Delete" : action === "enable" ? "Enable" : "Disable"} Site`,
          payload.data.execution,
        );
        setStatusMessage(
          `${action === "delete" ? "Deleted" : action === "enable" ? "Enabled" : "Disabled"} ${domain}.`,
        );
      } catch (siteError) {
        setTerminal({
          title: `${action === "delete" ? "Delete" : action === "enable" ? "Enable" : "Disable"} Site`,
          commandText,
          output:
            siteError instanceof Error
              ? siteError.message
              : `Unable to ${action} WordOps site`,
          status: "failed",
        });
        setError(
          siteError instanceof Error
            ? siteError.message
            : `Unable to ${action} WordOps site`,
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
        setStatusMessage("Health checks ran successfully for this server.");

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
            : "Unable to run health checks",
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

  useEffect(() => {
    loadChecks(0);
    loadIncidents(0);
    loadRuns(0);
    loadActivity(0);
    // Load the default server detail slices on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Server Detail
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{server.name}</h1>
        <p className="text-sm text-muted-foreground">
          {server.hostname} • {server.environment} • onboarding status: {server.onboardingStatus}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTION_LINKS.map((link) => (
          <a
            className="rounded-full border border-border bg-white/80 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            href={link.href}
            key={link.href}
          >
            {link.label}
          </a>
        ))}
      </div>

      <Card id="server-information" className="space-y-2 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">Server information</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Core identity and state. The operational cards come after this.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getToneClasses(serverHealth.tone)}`}
            >
              {serverHealth.label}
            </div>
            <div className="rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {providerLabel}
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-white/75 p-3 text-sm text-foreground">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Identity
            </div>
            <div className="mt-1.5 font-medium">{server.name}</div>
            <div className="mt-1 text-muted-foreground">{server.hostname}</div>
            <div className="mt-1 text-muted-foreground">
              {server.environment} • {server.onboardingStatus}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-white/75 p-3 text-sm text-foreground">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">SSH</div>
            <div className="mt-1.5">
              {server.sshUsername}@{server.ipAddress ?? server.hostname}:{server.sshPort}
            </div>
            <div className="mt-1 text-muted-foreground">Mode: {server.sshAuthMode}</div>
          </div>
        </div>

        {server.notes ? (
          <div className="rounded-xl border border-border bg-white/75 p-3 text-sm text-foreground">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Notes</div>
            <div className="mt-1.5">{server.notes}</div>
          </div>
        ) : null}
      </Card>

      {server.providerSnapshot ? (
        <Card id="linode-standard-info" className="space-y-2 p-4 md:p-5">
          <LinodeStandardInfo server={server} />
        </Card>
      ) : null}

      <Card id="wordops" className="space-y-3 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              WordOps
            </div>
            <h2 className="mt-1 text-base font-semibold text-foreground">WordOps runtime</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Live `wo` status plus the site inventory synced into this dashboard.
            </p>
          </div>
          <div
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getToneClasses(wordopsTone)}`}
          >
            {wordopsStatusLabel}
          </div>
        </div>

        {statusMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {statusMessage}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {wordops.status === "missing" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            <div className="font-medium">WordOps CLI was not detected on this server.</div>
            <div className="mt-1 text-amber-700">
              Install WordOps on the server, then click <span className="font-medium">Refresh WordOps</span>.
            </div>
          </div>
        ) : null}

        {wordops.status === "degraded" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            <div className="font-medium">WordOps is installed, but the web stack is not ready yet.</div>
            <div className="mt-1 text-amber-700">
              Use <span className="font-medium">Install Web Stack</span> to provision Nginx, PHP, and SQL before creating sites.
            </div>
          </div>
        ) : null}

        {wordops.status === "ready" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            <div className="font-medium">WordOps is ready for site management.</div>
            <div className="mt-1 text-emerald-700">
              Sync sites or create the first WordPress site from this card.
            </div>
          </div>
        ) : null}

        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-white/75 p-3 text-sm text-foreground">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              CLI
            </div>
            <div className="mt-1.5">
              {wordops.installed ? "Installed" : "Missing"}
            </div>
            <div className="mt-1 text-muted-foreground">
              {wordops.installed
                ? wordops.version
                  ? `WordOps ${wordops.version}`
                  : "Command detected on the live server"
                : "The `wo` command was not found on this server."}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-white/75 p-3 text-sm text-foreground">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Live Sites
            </div>
            <div className="mt-1.5">
              {wordops.sites.length}
            </div>
            <div className="mt-1 text-muted-foreground">
              Parsed from `wo site list`
            </div>
          </div>
          <div className="rounded-xl border border-border bg-white/75 p-3 text-sm text-foreground">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Synced Sites
            </div>
            <div className="mt-1.5">
              {sites.length}
            </div>
            <div className="mt-1 text-muted-foreground">
              Stored locally for dashboard views
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={isPending} onClick={handleRefreshWordops} type="button" variant="secondary">
            Refresh WordOps
          </Button>
          <Button
            disabled={isPending || !wordops.installed || wordopsReady}
            onClick={handleInstallWordopsStack}
            type="button"
          >
            Install Web Stack
          </Button>
          <Button disabled={isPending || !wordopsReady} onClick={handleSyncWordopsSites} type="button">
            Sync Sites
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-slate-950 px-3 py-3 text-xs text-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold uppercase tracking-[0.2em] text-slate-300">
              Terminal
            </div>
            <div
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                terminal?.status === "succeeded"
                  ? "bg-emerald-500/15 text-emerald-200"
                  : terminal?.status === "failed"
                    ? "bg-rose-500/15 text-rose-200"
                    : "bg-slate-700 text-slate-200"
              }`}
            >
              {terminal?.status ?? "idle"}
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="text-[11px] text-slate-400">
              {terminal?.title ?? "No WordOps command has been run from this page yet."}
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-black/30 px-3 py-2 font-mono text-[12px] text-slate-100">
              {terminal?.commandText ? `$ ${terminal.commandText}` : "$"}
            </pre>
            <pre className="min-h-[96px] overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-black/30 px-3 py-2 font-mono text-[12px] text-slate-200">
              {terminal?.output ?? "Waiting for a WordOps action..."}
            </pre>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-white/75 p-3 text-sm text-foreground">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Nginx</div>
            <div className="mt-1.5">{wordops.stack.nginxInstalled ? "Installed" : "Missing"}</div>
          </div>
          <div className="rounded-xl border border-border bg-white/75 p-3 text-sm text-foreground">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">PHP</div>
            <div className="mt-1.5">{wordops.stack.phpInstalled ? "Installed" : "Missing"}</div>
          </div>
          <div className="rounded-xl border border-border bg-white/75 p-3 text-sm text-foreground">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">SQL</div>
            <div className="mt-1.5">{wordops.stack.mysqlInstalled ? "Installed" : "Missing"}</div>
          </div>
          <div className="rounded-xl border border-border bg-white/75 p-3 text-sm text-foreground">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">WP-CLI</div>
            <div className="mt-1.5">{wordops.stack.wpCliInstalled ? "Installed" : "Missing"}</div>
          </div>
        </div>

        <form className="space-y-3 rounded-xl border border-border bg-white/75 p-3" onSubmit={handleCreateWordopsSite}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                New WordPress Site
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                WordOps-first creation flow for a new managed site.
              </div>
            </div>
            <Button disabled={isPending || !wordopsReady} type="submit">
              Create Site
            </Button>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-foreground">Domain</span>
              <input
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                onChange={(event) => setSiteForm((current) => ({ ...current, domain: event.target.value }))}
                placeholder="example.com"
                value={siteForm.domain}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-foreground">Cache Profile</span>
              <select
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                onChange={(event) =>
                  setSiteForm((current) => ({
                    ...current,
                    cacheProfile: event.target.value as WordopsCreateSiteInput["cacheProfile"],
                  }))
                }
                value={siteForm.cacheProfile}
              >
                <option value="wp">WordPress</option>
                <option value="wpfc">FastCGI cache</option>
                <option value="wpredis">Redis cache</option>
                <option value="wpsc">WP Super Cache</option>
                <option value="wprocket">WP Rocket</option>
                <option value="wpce">Cache Enabler</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-foreground">PHP</span>
              <select
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                onChange={(event) =>
                  setSiteForm((current) => ({
                    ...current,
                    phpVersion:
                      event.target.value === ""
                        ? undefined
                        : (event.target.value as "8.2" | "8.3"),
                  }))
                }
                value={siteForm.phpVersion ?? ""}
              >
                <option value="">Default</option>
                <option value="8.2">PHP 8.2</option>
                <option value="8.3">PHP 8.3</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-foreground">Admin User</span>
              <input
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                onChange={(event) => setSiteForm((current) => ({ ...current, adminUser: event.target.value }))}
                placeholder="admin"
                value={siteForm.adminUser ?? ""}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-foreground">Admin Email</span>
              <input
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                onChange={(event) => setSiteForm((current) => ({ ...current, adminEmail: event.target.value }))}
                placeholder="admin@example.com"
                value={siteForm.adminEmail ?? ""}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-foreground">Admin Password</span>
              <input
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                onChange={(event) => setSiteForm((current) => ({ ...current, adminPassword: event.target.value }))}
                placeholder="Optional"
                type="password"
                value={siteForm.adminPassword ?? ""}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <label className="inline-flex items-center gap-2">
              <input
                checked={siteForm.letsEncrypt ?? false}
                onChange={(event) =>
                  setSiteForm((current) => ({
                    ...current,
                    letsEncrypt: event.target.checked,
                    ...(event.target.checked ? {} : { hsts: false }),
                  }))
                }
                type="checkbox"
              />
              Let's Encrypt
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                checked={siteForm.hsts ?? false}
                disabled={!(siteForm.letsEncrypt ?? false)}
                onChange={(event) => setSiteForm((current) => ({ ...current, hsts: event.target.checked }))}
                type="checkbox"
              />
              HSTS
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                checked={siteForm.vhostOnly ?? false}
                onChange={(event) => setSiteForm((current) => ({ ...current, vhostOnly: event.target.checked }))}
                type="checkbox"
              />
              Vhost only
            </label>
          </div>
        </form>

        {displayedSites.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Sites
              </div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                {sites.length > 0 ? "Synced inventory" : "Live discovery"}
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {displayedSites.map((site) => (
                <div className="rounded-xl border border-border bg-white/75 p-3 text-sm text-foreground" key={`${site.domain}:${site.sitePath}`}>
                  <div className="font-medium">{site.domain}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{site.sitePath}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span className="rounded-full border border-border px-2 py-0.5">{site.appType}</span>
                    {site.cacheType ? (
                      <span className="rounded-full border border-border px-2 py-0.5">{site.cacheType}</span>
                    ) : null}
                    {site.phpVersion ? (
                      <span className="rounded-full border border-border px-2 py-0.5">PHP {site.phpVersion}</span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      disabled={isPending || !wordopsReady}
                      onClick={() => handleMutateWordopsSite(site.domain, "enable")}
                      type="button"
                      variant="secondary"
                    >
                      Enable
                    </Button>
                    <Button
                      disabled={isPending || !wordopsReady}
                      onClick={() => handleMutateWordopsSite(site.domain, "disable")}
                      type="button"
                      variant="secondary"
                    >
                      Disable
                    </Button>
                    <Button
                      disabled={isPending || !wordopsReady}
                      onClick={() => handleMutateWordopsSite(site.domain, "delete")}
                      type="button"
                      variant="ghost"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {wordops.infoOutput ? (
          <div className="rounded-xl border border-border bg-slate-950 px-3 py-3 text-xs text-slate-100">
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono">
              {wordops.infoOutput}
            </pre>
          </div>
        ) : null}
      </Card>

      <Card id="recent-checks" className="space-y-2 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Recent Checks
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
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
            <Button
              disabled={isPending}
              onClick={() => loadChecks(0)}
              type="button"
              variant="secondary"
            >
              Refresh
            </Button>
            <Button disabled={isPending} onClick={handleRunChecks} type="button">
              Run Checks Now
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {checks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent checks loaded yet.</p>
          ) : (
            checks.map((check) =>
              (() => {
                const incidentHref = getActiveIncidentHref(incidents, check.checkType);

                const content = (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium">{check.checkType}</div>
                        <div className="text-muted-foreground">{check.summary}</div>
                      </div>
                      {incidentHref ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] uppercase tracking-[0.24em] text-amber-700">
                          Active incident
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={`rounded-full border px-2 py-0.5 uppercase tracking-[0.2em] ${getToneClasses(getCheckTone(check.status))}`}
                      >
                        {check.status}
                      </span>
                      <span>{new Date(check.createdAt).toLocaleString()}</span>
                    </div>
                  </>
                );

                if (incidentHref) {
                  return (
                    <a
                      className="block rounded-xl border border-border bg-white/75 p-2.5 text-sm text-foreground transition hover:border-primary/40 hover:bg-white"
                      href={incidentHref}
                      key={check.id}
                    >
                      {content}
                    </a>
                  );
                }

                return (
                  <div
                    className="rounded-xl border border-border bg-white/75 p-2.5 text-sm text-foreground"
                    key={check.id}
                  >
                    {content}
                  </div>
                );
              })(),
            )
          )}
        </div>

        {checksPagination ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
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
      </Card>

      <Card id="server-incidents" className="space-y-2 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Incidents
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {incidentsPagination ? (
                <span>
                  Showing {incidentsPagination.offset + 1}-{incidentsPagination.offset + incidentsPagination.returned} of{" "}
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

        <div className="space-y-2">
          {incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents loaded yet.</p>
          ) : (
            incidents.map((incident) => (
              <div
                className="rounded-xl border border-border bg-white/75 p-2.5 text-sm text-foreground"
                id={`incident-${incident.id}`}
                key={incident.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">{incident.title}</div>
                    <div className="text-muted-foreground">{incident.summary ?? "No summary"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={`rounded-full border px-2 py-0.5 uppercase tracking-[0.2em] ${getToneClasses(getIncidentTone(incident.severity))}`}
                      >
                        {incident.severity}
                      </span>
                      <span>{incident.status}</span>
                      <span>{new Date(incident.openedAt).toLocaleString()}</span>
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
                        {incident.remediation.reasons[0] ??
                          "No allowlisted remediations are available for this incident."}
                      </div>
                    )}
                  </div>
                ) : null}
                {incident.status === "remediation_pending" ? (
                  <div className="mt-2 text-xs text-amber-700">
                    Remediation completed. Waiting for a healthy follow-up check before resolution.
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {incidentsPagination ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
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
      </Card>

      <Card id="remediation-runs" className="space-y-2 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Remediation Runs
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
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

        <div className="space-y-2">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No remediation runs loaded yet.</p>
          ) : (
            runs.map((run) => (
              <div
                className="rounded-xl border border-border bg-white/75 p-2.5 text-sm text-foreground"
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
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
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
      </Card>

      <Card id="activity-feed" className="space-y-2 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Activity Feed
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
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

        <div className="grid gap-2 rounded-xl border border-border bg-white/70 p-3 lg:grid-cols-[160px_minmax(0,1fr)_auto_auto]">
          <label className="space-y-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Kind
            <select
              className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal uppercase tracking-normal text-foreground"
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
              className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground"
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

        <div className="space-y-2">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {appliedActivityKindFilter !== "all" || appliedActivityEventType
                ? "No activity matched the current filters."
                : "No activity loaded yet."}
            </p>
          ) : (
            activity.map((entry) => (
              <a
                className="block rounded-xl border border-border bg-white/75 p-2.5 text-sm text-foreground transition hover:border-primary/40 hover:bg-white"
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
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
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
      </Card>
    </div>
  );
}
