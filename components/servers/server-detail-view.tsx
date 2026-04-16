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
  closeIncident,
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
  updateServerWordopsSite,
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
  type WordopsSiteUpdateInput,
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
  { href: "#server-incidents", label: "Incidents" },
  { href: "#recent-checks", label: "Checks" },
  { href: "#remediation-runs", label: "Remediations" },
  { href: "#activity-feed", label: "Activity" },
] as const;
const TOP_CHECK_STRIP = [
  { checkType: "host.uptime", label: "Uptime" },
  { checkType: "host.disk.root", label: "Disk" },
  { checkType: "service.nginx", label: "Nginx" },
  { checkType: "service.sql", label: "SQL" },
  { checkType: "service.phpfpm", label: "PHP-FPM" },
] as const;

const CHECK_LABELS: Record<string, string> = {
  "host.disk.root": "Disk",
  "host.uptime": "Uptime",
  "service.nginx": "Nginx",
  "service.phpfpm": "PHP-FPM",
  "service.sql": "SQL",
};

const REMEDIATION_LABELS: Record<string, string> = {
  "provider.reboot": "Reboot Server",
  "restart.nginx": "Restart Nginx",
  "restart.phpfpm": "Restart PHP-FPM",
  "restart.sql": "Restart SQL",
  "wordpress.cache.flush": "Flush Cache",
};

interface ServerDetailViewProps {
  initialActivityEventType: string;
  initialActivityKindFilter: ActivityKindFilter;
  initialActivity: ServerActivityItem[];
  initialActivityPagination: PaginationMeta | null;
  initialChecks: HealthCheckRecord[];
  initialChecksPagination: PaginationMeta | null;
  initialIncidents: IncidentRecord[];
  initialIncidentsPagination: PaginationMeta | null;
  initialSites: WordopsSiteRecord[];
  initialWordopsDeferred?: boolean;
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

interface SiteUpdateDraft {
  cacheProfile: "" | NonNullable<WordopsSiteUpdateInput["cacheProfile"]>;
  phpVersion: "" | NonNullable<WordopsSiteUpdateInput["phpVersion"]>;
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

function buildUpdateSiteCommand(domain: string, input: WordopsSiteUpdateInput) {
  const parts = ["wo", "site", "update", domain];

  if (input.cacheProfile) {
    parts.push(`--${input.cacheProfile}`);
  }

  if (input.phpVersion === "8.2") {
    parts.push("--php82");
  }

  if (input.phpVersion === "8.3") {
    parts.push("--php83");
  }

  if (input.letsEncrypt === true) {
    parts.push("--letsencrypt");
  }

  if (input.letsEncrypt === false) {
    parts.push("--letsencrypt=off");
  }

  if (input.hsts === true) {
    parts.push("--hsts");
  }

  if (input.hsts === false) {
    parts.push("--hsts=off");
  }

  return parts.join(" ");
}

function getInitialSiteUpdateDraft(site: WordopsSiteRecord): SiteUpdateDraft {
  return {
    cacheProfile:
      site.cacheType === "wordpress" ? "wp" :
      site.cacheType === "fastcgi_cache" ? "wpfc" :
      site.cacheType === "redis" ? "wpredis" :
      site.cacheType === "wp_super_cache" ? "wpsc" :
      site.cacheType === "wp_rocket" ? "wprocket" :
      site.cacheType === "cache_enabler" ? "wpce" :
      "",
    phpVersion:
      site.phpVersion === "8.2" ||
      site.phpVersion === "8.3"
        ? site.phpVersion
        : "",
  };
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
    (incident) =>
      incident.checkType === checkType &&
      (incident.status === "open" || incident.status === "remediation_pending"),
  );

  return activeIncident ? `/incidents/${activeIncident.id}` : null;
}

function getSiteTypeLabel(site: WordopsSiteRecord) {
  if (!site.appType || site.appType === "unknown") {
    return "WordPress";
  }

  if (site.appType === "wordpress") {
    return "WordPress";
  }

  return site.appType;
}

function getSitePhpLabel(site: WordopsSiteRecord, wordops: WordopsOverview) {
  if (site.phpVersion) {
    return `PHP ${site.phpVersion}`;
  }

  const fallbackVersion = wordops.infoOutput?.match(/\bPHP\s*\(([0-9]+\.[0-9]+)/)?.[1];

  if (fallbackVersion) {
    return `PHP ${fallbackVersion}`;
  }

  return "PHP Default";
}

function getCheckLabel(checkType?: string) {
  if (!checkType) {
    return "Check";
  }

  return CHECK_LABELS[checkType] ?? checkType;
}

function getRemediationLabel(actionType?: string) {
  if (!actionType) {
    return "Remediation";
  }

  return REMEDIATION_LABELS[actionType] ?? actionType;
}

export function ServerDetailView({
  initialActivityEventType,
  initialActivityKindFilter,
  initialActivity,
  initialActivityPagination,
  initialChecks,
  initialChecksPagination,
  initialIncidents,
  initialIncidentsPagination,
  initialSites,
  initialWordopsDeferred = false,
  initialWordops,
  server,
}: ServerDetailViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [wordops, setWordops] = useState<WordopsOverview>(initialWordops);
  const [isWordopsLoading, setIsWordopsLoading] = useState(initialWordopsDeferred);
  const [sites, setSites] = useState<WordopsSiteRecord[]>(initialSites);
  const [siteUpdateDrafts, setSiteUpdateDrafts] = useState<Record<string, SiteUpdateDraft>>({});
  const [expandedSiteActions, setExpandedSiteActions] = useState<Record<string, boolean>>({});
  const [terminal, setTerminal] = useState<WordopsTerminalState | null>(null);
  const [showSiteAdvanced, setShowSiteAdvanced] = useState(false);
  const [siteForm, setSiteForm] = useState<WordopsCreateSiteInput>({
    cacheProfile: "wp",
    domain: "",
    letsEncrypt: true,
  });
  const [checks, setChecks] = useState<HealthCheckRecord[]>(initialChecks);
  const [checksPagination, setChecksPagination] =
    useState<PaginationMeta | null>(initialChecksPagination);
  const [checksOffset, setChecksOffset] = useState(0);
  const [incidents, setIncidents] = useState<IncidentRecord[]>(initialIncidents);
  const [incidentsPagination, setIncidentsPagination] =
    useState<PaginationMeta | null>(initialIncidentsPagination);
  const [incidentsOffset, setIncidentsOffset] = useState(0);
  const [showResolvedIncidents, setShowResolvedIncidents] = useState(
    initialIncidents.every((incident) => incident.status === "resolved"),
  );
  const [runs, setRuns] = useState<RemediationRunRecord[]>([]);
  const [runsPagination, setRunsPagination] = useState<PaginationMeta | null>(null);
  const [runsOffset, setRunsOffset] = useState(0);
  const [hasLoadedRuns, setHasLoadedRuns] = useState(false);
  const [showRunsSection, setShowRunsSection] = useState(false);
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
  const [showActivitySection, setShowActivitySection] = useState(
    initialActivityKindFilter !== "all" ||
      initialActivityEventType.length > 0 ||
      initialActivity.length > 0,
  );
  const [showActivityFilters, setShowActivityFilters] = useState(
    initialActivityKindFilter !== "all" || initialActivityEventType.length > 0,
  );
  const [activityOffset, setActivityOffset] = useState(0);
  const providerLabel = server.providerMatch
    ? server.providerMatch.providerKind === "linode"
      ? "Akamai"
      : "DigitalOcean"
    : "Unmatched";
  const serverHealth = getServerHealthSummary(server, incidents);
  const displayedSites = sites.length > 0 ? sites : wordops.sites;
  const unresolvedIncidents = incidents.filter(
    (incident) => incident.status === "open" || incident.status === "remediation_pending",
  );
  const resolvedIncidents = incidents.filter((incident) => incident.status === "resolved");
  const openIncidentCount = incidents.filter((incident) => incident.status === "open").length;
  const pendingIncidentCount = incidents.filter(
    (incident) => incident.status === "remediation_pending",
  ).length;
  const visibleIncidents = showResolvedIncidents ? incidents : unresolvedIncidents;
  const wordopsTone =
    isWordopsLoading
      ? "neutral"
      : wordops.status === "ready"
      ? "good"
      : wordops.status === "missing" || wordops.status === "degraded"
        ? "warn"
        : "danger";
  const wordopsReady = wordops.status === "ready";
  const wordopsStatusLabel =
    isWordopsLoading
      ? "Loading"
      : wordops.status === "missing"
      ? "Not Found"
      : wordops.status === "degraded"
        ? "Stack Incomplete"
        : wordops.status === "ready"
          ? "Ready"
          : "Error";
  const latestCheckByType = new Map(checks.map((check) => [check.checkType, check]));

  function handleSyncWordopsSites() {
    setError(null);
    setStatusMessage(null);
    setIsWordopsLoading(false);

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
    setIsWordopsLoading(false);
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
    setIsWordopsLoading(false);
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
    setIsWordopsLoading(false);
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

  function handleUpdateWordopsSite(
    domain: string,
    title: string,
    input: WordopsSiteUpdateInput,
  ) {
    setError(null);
    setStatusMessage(null);
    setIsWordopsLoading(false);
    const commandText = buildUpdateSiteCommand(domain, input);
    setTerminal({
      title,
      commandText,
      output: `Executing ${title.toLowerCase()}...`,
      status: "running",
    });

    startTransition(async () => {
      try {
        const payload = await updateServerWordopsSite(server.id, domain, input);
        setWordops(payload.data.overview);
        setSites(payload.data.sites);
        applyTerminalResult(setTerminal, title, payload.data.execution);
        setStatusMessage(`${title} completed for ${domain}.`);
      } catch (siteError) {
        setTerminal({
          title,
          commandText,
          output:
            siteError instanceof Error
              ? siteError.message
              : `Unable to complete ${title.toLowerCase()}`,
          status: "failed",
        });
        setError(
          siteError instanceof Error
            ? siteError.message
            : `Unable to complete ${title.toLowerCase()}`,
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

  function loadWordops() {
    setIsWordopsLoading(true);

    startTransition(async () => {
      try {
        const payload = await getServerWordops(server.id);
        setWordops(payload.data.overview);
      } catch {
        setWordops({
          installed: false,
          sites: [],
          stack: {
            mysqlInstalled: false,
            nginxInstalled: false,
            phpInstalled: false,
            wpCliInstalled: false,
          },
          status: "error",
        });
      } finally {
        setIsWordopsLoading(false);
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
        setHasLoadedRuns(true);
        if (payload.data.runs.some((run) => run.status !== "succeeded")) {
          setShowRunsSection(true);
        }
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
        setHasLoadedRuns(true);
        setShowRunsSection(true);
        setStatusMessage(`Executed ${getRemediationLabel(actionType)}.`);
      } catch (runError) {
        setError(
          runError instanceof Error ? runError.message : "Unable to execute remediation",
        );
      }
    });
  }

  function handleCloseIncident(incidentId: string) {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        await closeIncident(incidentId);
        await Promise.all([loadIncidents(0), loadRuns(runsOffset), loadActivity(activityOffset)]);
        setStatusMessage("Incident closed.");
      } catch (closeError) {
        setError(
          closeError instanceof Error ? closeError.message : "Unable to close incident",
        );
      }
    });
  }

  useEffect(() => {
    if (initialWordopsDeferred) {
      loadWordops();
    }
    // Defer live WordOps SSH inspection until after first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWordopsDeferred, server.id]);

  useEffect(() => {
    setChecks(initialChecks);
    setChecksPagination(initialChecksPagination);
    setChecksOffset(0);
    setRuns([]);
    setRunsPagination(null);
    setRunsOffset(0);
    setHasLoadedRuns(false);
    setShowRunsSection(false);
    // Checks are SSR-seeded. Runs stay lazy until needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id, initialChecks, initialChecksPagination]);

  useEffect(() => {
    setSiteUpdateDrafts((current) => {
      const next = { ...current };

      for (const site of displayedSites) {
        if (!next[site.domain]) {
          next[site.domain] = getInitialSiteUpdateDraft(site);
        }
      }

      return next;
    });
  }, [displayedSites]);

  useEffect(() => {
    if (pendingIncidentCount > 0 || runs.some((run) => run.status !== "succeeded")) {
      setShowRunsSection(true);
    }
  }, [pendingIncidentCount, runs]);

  useEffect(() => {
    if (pendingIncidentCount > 0 && !hasLoadedRuns) {
      loadRuns(0);
    }
    // Pull run history only when there is active remediation state to explain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingIncidentCount, hasLoadedRuns, server.id]);

  return (
    <div className="space-y-4">
      <Card id="server-information" className="space-y-3 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{server.name}</h1>
            <p className="text-sm text-muted-foreground">
              {server.hostname}
              {server.ipAddress ? ` • ${server.ipAddress}` : ""}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{server.environment}</span>
              <span>{server.sshUsername}@{server.ipAddress ?? server.hostname}:{server.sshPort}</span>
            </div>
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
            <div className="rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {server.onboardingStatus}
            </div>
            {server.providerSnapshot ? (
              <div className="rounded-full border border-border bg-card/70 px-2.5 py-1 text-[10px] text-muted-foreground">
                {server.providerSnapshot.summary}
              </div>
            ) : null}
            {server.providerSnapshot ? (
              server.providerSnapshot.tags.length > 0 ? (
                server.providerSnapshot.tags.map((tag) => (
                  <div
                    className="rounded-full border border-border bg-card/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                    key={tag}
                  >
                    {tag}
                  </div>
                ))
              ) : (
                <div className="rounded-full border border-border bg-card/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  No tags
                </div>
              )
            ) : null}
          </div>
        </div>

        {server.providerSnapshot ? <LinodeStandardInfo server={server} /> : null}

        <div className="flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
          {TOP_CHECK_STRIP.map((item) => {
            const check = latestCheckByType.get(item.checkType);
            const tone = check ? getCheckTone(check.status) : "neutral";

            return (
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${getToneClasses(tone)}`}
                key={item.checkType}
                title={check ? `${item.label}: ${check.summary}` : `${item.label}: waiting for check`}
              >
                <span>{item.label}</span>
                <span className="text-[9px] opacity-80">
                  {check ? check.status : "pending"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
          <div className="rounded-full border border-border bg-card/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Open Incidents {openIncidentCount}
          </div>
          <div className="rounded-full border border-border bg-card/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Pending {pendingIncidentCount}
          </div>
          <div className="rounded-full border border-border bg-card/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Sites {displayedSites.length}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/70 pt-2">
          {SECTION_LINKS.map((link) => (
            <a
              className="rounded-full border border-border bg-card/70 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>

        {server.notes ? (
          <div className="rounded-lg border border-border bg-card/70 p-3 text-sm text-foreground">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Notes</div>
            <div className="mt-1.5">{server.notes}</div>
          </div>
        ) : null}
      </Card>

      {unresolvedIncidents.length > 0 ? (
        <Card id="server-attention" className="space-y-3 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Attention
            </div>
            <div className="flex flex-wrap gap-1.5">
              <div className="rounded-full border border-rose-500/30 bg-rose-500/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-rose-200">
                Open {openIncidentCount}
              </div>
              <div className="rounded-full border border-amber-500/30 bg-amber-500/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-200">
                Pending {pendingIncidentCount}
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {unresolvedIncidents.slice(0, 2).map((incident) => (
              <div className="rounded-lg border border-border bg-card/70 p-3 text-sm text-foreground" key={incident.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">{incident.title}</div>
                    <div className="text-muted-foreground">{incident.summary ?? "No summary"}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{getCheckLabel(incident.checkType)}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 uppercase tracking-[0.2em] ${getToneClasses(getIncidentTone(incident.severity))}`}
                      >
                        {incident.severity}
                      </span>
                      <span>{incident.status}</span>
                    </div>
                  </div>
                  <a
                    className="rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                    href={`/incidents/${incident.id}`}
                  >
                    Open
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card id="wordops" className="space-y-3 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              WordOps
            </div>
            <h2 className="mt-1 text-base font-semibold text-foreground">Sites & stack</h2>
          </div>
          <div
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getToneClasses(wordopsTone)}`}
          >
            {wordopsStatusLabel}
          </div>
        </div>

        {statusMessage ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/12 px-3 py-2 text-sm text-emerald-200">
            {statusMessage}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/12 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {isWordopsLoading ? (
          <div className="rounded-lg border border-border bg-card/70 px-3 py-2 text-sm text-muted-foreground">
            Loading live WordOps status…
          </div>
        ) : null}

        {wordops.status === "missing" ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/12 px-3 py-3 text-sm text-amber-200">
            <div className="font-medium">WordOps CLI not detected.</div>
          </div>
        ) : null}

        {wordops.status === "degraded" ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/12 px-3 py-3 text-sm text-amber-200">
            <div className="font-medium">Stack incomplete. Install the web stack before creating sites.</div>
          </div>
        ) : null}

        {wordops.status === "ready" ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/12 px-3 py-3 text-sm text-emerald-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">WordOps is ready for site management.</div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-emerald-500/30 bg-card/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
                  Live Sites {wordops.sites.length}
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-card/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
                  Synced Sites {sites.length}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${
              wordops.installed
                ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
                : "border-amber-500/30 bg-amber-500/12 text-amber-200"
            }`}
          >
            <span>CLI</span>
            <span>{wordops.installed ? "installed" : "missing"}</span>
            {wordops.version ? <span>{wordops.version}</span> : null}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${
              wordops.stack.nginxInstalled
                ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
                : "border-amber-500/30 bg-amber-500/12 text-amber-200"
            }`}
          >
            <span>Nginx</span>
            <span>{wordops.stack.nginxInstalled ? "installed" : "missing"}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${
              wordops.stack.phpInstalled
                ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
                : "border-amber-500/30 bg-amber-500/12 text-amber-200"
            }`}
          >
            <span>PHP</span>
            <span>{wordops.stack.phpInstalled ? "installed" : "missing"}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${
              wordops.stack.mysqlInstalled
                ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
                : "border-amber-500/30 bg-amber-500/12 text-amber-200"
            }`}
          >
            <span>SQL</span>
            <span>{wordops.stack.mysqlInstalled ? "installed" : "missing"}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${
              wordops.stack.wpCliInstalled
                ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
                : "border-amber-500/30 bg-amber-500/12 text-amber-200"
            }`}
          >
            <span>WP-CLI</span>
            <span>{wordops.stack.wpCliInstalled ? "installed" : "missing"}</span>
          </span>
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

        <form className="space-y-3 rounded-lg border border-border bg-card/70 p-3" onSubmit={handleCreateWordopsSite}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              New WordPress Site
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isPending}
                onClick={() => setShowSiteAdvanced((current) => !current)}
                type="button"
                variant="secondary"
              >
                {showSiteAdvanced ? "Hide Advanced" : "Advanced"}
              </Button>
              <Button disabled={isPending || !wordopsReady} type="submit">
                Create Site
              </Button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-foreground">Domain</span>
              <input
                className="h-11 w-full rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground"
                onChange={(event) => setSiteForm((current) => ({ ...current, domain: event.target.value }))}
                placeholder="example.com"
                value={siteForm.domain}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-foreground">Cache Profile</span>
              <select
                className="h-11 w-full rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground"
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
                className="h-11 w-full rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground"
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
          </div>

          {showSiteAdvanced ? (
            <div className="grid gap-2 border-t border-border/70 pt-3 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-foreground">Admin User</span>
                <input
                  className="h-11 w-full rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground"
                  onChange={(event) => setSiteForm((current) => ({ ...current, adminUser: event.target.value }))}
                  placeholder="admin"
                  value={siteForm.adminUser ?? ""}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-foreground">Admin Email</span>
                <input
                  className="h-11 w-full rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground"
                  onChange={(event) => setSiteForm((current) => ({ ...current, adminEmail: event.target.value }))}
                  placeholder="admin@example.com"
                  value={siteForm.adminEmail ?? ""}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-foreground">Admin Password</span>
                <input
                  className="h-11 w-full rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground"
                  onChange={(event) => setSiteForm((current) => ({ ...current, adminPassword: event.target.value }))}
                  placeholder="Optional"
                  type="password"
                  value={siteForm.adminPassword ?? ""}
                />
              </label>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
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
            </div>
          ) : null}
        </form>

        {terminal ? (
          <div className="rounded-xl border border-border bg-slate-950 px-3 py-3 text-xs text-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold uppercase tracking-[0.2em] text-slate-300">
                Terminal
              </div>
              <div
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  terminal.status === "succeeded"
                    ? "bg-emerald-500/15 text-emerald-200"
                    : terminal.status === "failed"
                      ? "bg-rose-500/15 text-rose-200"
                      : "bg-slate-700 text-slate-200"
                }`}
              >
                {terminal.status}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <div className="text-[11px] text-slate-400">{terminal.title}</div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-black/30 px-3 py-2 font-mono text-[12px] text-slate-100">
                {terminal.commandText ? `$ ${terminal.commandText}` : "$"}
              </pre>
              <pre className="min-h-[96px] overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-black/30 px-3 py-2 font-mono text-[12px] text-slate-200">
                {terminal.output}
              </pre>
            </div>
          </div>
        ) : null}

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
                <div className="rounded-lg border border-border bg-card/70 p-3 text-sm text-foreground" key={`${site.domain}:${site.sitePath}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <a
                          className="font-medium text-foreground underline-offset-4 transition hover:text-primary hover:underline"
                          href={`https://${site.domain}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {site.domain}
                        </a>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {getSiteTypeLabel(site)}
                        </span>
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-primary">
                          {getSitePhpLabel(site, wordops)}
                        </span>
                        {site.cacheType ? (
                          <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            {site.cacheType}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{site.sitePath}</div>
                    </div>
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
                    <Button
                      disabled={isPending || !wordopsReady}
                      onClick={() =>
                        setExpandedSiteActions((current) => ({
                          ...current,
                          [site.domain]: !current[site.domain],
                        }))
                      }
                      type="button"
                      variant="secondary"
                    >
                      {expandedSiteActions[site.domain] ? "Hide Update" : "Update"}
                    </Button>
                  </div>
                  {expandedSiteActions[site.domain] ? (
                    <div className="mt-3 space-y-3 rounded-lg border border-border/70 bg-background/30 p-3">
                      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                        <label className="space-y-1">
                          <span className="text-[11px] font-medium text-foreground">PHP version</span>
                          <select
                            className="h-10 w-full rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground"
                            onChange={(event) =>
                              setSiteUpdateDrafts((current) => ({
                                ...current,
                                [site.domain]: {
                                  ...(current[site.domain] ?? getInitialSiteUpdateDraft(site)),
                                  phpVersion: event.target.value as SiteUpdateDraft["phpVersion"],
                                },
                              }))
                            }
                            value={(siteUpdateDrafts[site.domain] ?? getInitialSiteUpdateDraft(site)).phpVersion}
                          >
                            <option value="">Select PHP</option>
                            <option value="8.2">PHP 8.2</option>
                            <option value="8.3">PHP 8.3</option>
                          </select>
                        </label>
                        <div className="flex items-end">
                          <Button
                            disabled={
                              isPending ||
                              !wordopsReady ||
                              !(siteUpdateDrafts[site.domain] ?? getInitialSiteUpdateDraft(site)).phpVersion
                            }
                            onClick={() =>
                              handleUpdateWordopsSite(site.domain, "Update Site PHP", {
                                phpVersion: (siteUpdateDrafts[site.domain] ?? getInitialSiteUpdateDraft(site))
                                  .phpVersion as NonNullable<WordopsSiteUpdateInput["phpVersion"]>,
                              })
                            }
                            type="button"
                            variant="secondary"
                          >
                            Apply PHP
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                        <label className="space-y-1">
                          <span className="text-[11px] font-medium text-foreground">Cache profile</span>
                          <select
                            className="h-10 w-full rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground"
                            onChange={(event) =>
                              setSiteUpdateDrafts((current) => ({
                                ...current,
                                [site.domain]: {
                                  ...(current[site.domain] ?? getInitialSiteUpdateDraft(site)),
                                  cacheProfile: event.target.value as SiteUpdateDraft["cacheProfile"],
                                },
                              }))
                            }
                            value={(siteUpdateDrafts[site.domain] ?? getInitialSiteUpdateDraft(site)).cacheProfile}
                          >
                            <option value="">Select cache</option>
                            <option value="wp">WordPress</option>
                            <option value="wpfc">FastCGI cache</option>
                            <option value="wpredis">Redis cache</option>
                            <option value="wpsc">WP Super Cache</option>
                            <option value="wprocket">WP Rocket</option>
                            <option value="wpce">Cache Enabler</option>
                          </select>
                        </label>
                        <div className="flex items-end">
                          <Button
                            disabled={
                              isPending ||
                              !wordopsReady ||
                              !(siteUpdateDrafts[site.domain] ?? getInitialSiteUpdateDraft(site)).cacheProfile
                            }
                            onClick={() =>
                              handleUpdateWordopsSite(site.domain, "Update Site Cache", {
                                cacheProfile: (siteUpdateDrafts[site.domain] ?? getInitialSiteUpdateDraft(site))
                                  .cacheProfile as NonNullable<WordopsSiteUpdateInput["cacheProfile"]>,
                              })
                            }
                            type="button"
                            variant="secondary"
                          >
                            Apply Cache
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={isPending || !wordopsReady}
                          onClick={() => handleUpdateWordopsSite(site.domain, "Enable SSL", { letsEncrypt: true })}
                          type="button"
                          variant="secondary"
                        >
                          Enable SSL
                        </Button>
                        <Button
                          disabled={isPending || !wordopsReady}
                          onClick={() => handleUpdateWordopsSite(site.domain, "Disable SSL", { letsEncrypt: false })}
                          type="button"
                          variant="secondary"
                        >
                          Disable SSL
                        </Button>
                        <Button
                          disabled={isPending || !wordopsReady}
                          onClick={() => handleUpdateWordopsSite(site.domain, "Enable HSTS", { hsts: true })}
                          type="button"
                          variant="secondary"
                        >
                          Enable HSTS
                        </Button>
                        <Button
                          disabled={isPending || !wordopsReady}
                          onClick={() => handleUpdateWordopsSite(site.domain, "Disable HSTS", { hsts: false })}
                          type="button"
                          variant="secondary"
                        >
                          Disable HSTS
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {wordops.infoOutput ? (
          <details className="rounded-lg border border-border bg-card/70 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer list-none font-medium uppercase tracking-[0.18em]">
              Raw WordOps Info
            </summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 font-mono text-[12px] text-slate-200">
              {wordops.infoOutput}
            </pre>
          </details>
        ) : null}
      </Card>

      <Card id="server-incidents" className="space-y-2 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Incidents
            </div>
            {incidentsPagination ? (
              <div className="text-xs text-muted-foreground">
                {incidentsPagination.offset + 1}-{incidentsPagination.offset + incidentsPagination.returned} / {incidentsPagination.total}
              </div>
            ) : null}
          </div>

          <Button
            disabled={isPending}
            onClick={() => loadIncidents(0)}
            type="button"
            variant="secondary"
          >
            Refresh
          </Button>
          {resolvedIncidents.length > 0 ? (
            <Button
              disabled={isPending}
              onClick={() => setShowResolvedIncidents((current) => !current)}
              type="button"
              variant="secondary"
            >
              {showResolvedIncidents ? "Hide Resolved" : `Show Resolved (${resolvedIncidents.length})`}
            </Button>
          ) : null}
        </div>

        <div className="space-y-2">
          {visibleIncidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {incidents.length === 0 ? "No incidents loaded yet." : "No open incidents."}
            </p>
          ) : (
            visibleIncidents.map((incident) => (
              <div
                className="rounded-lg border border-border bg-card/70 p-2.5 text-sm text-foreground"
                id={`incident-${incident.id}`}
                key={incident.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">{incident.title}</div>
                    <div className="text-muted-foreground">{incident.summary ?? "No summary"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{getCheckLabel(incident.checkType)}</span>
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
                    Open
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
                      <div className="text-xs text-amber-200">
                        {incident.remediation.reasons[0] ??
                          "No allowlisted remediations are available for this incident."}
                      </div>
                    )}
                  </div>
                ) : null}
                {incident.status === "remediation_pending" ? (
                  <div className="mt-2 text-xs text-amber-200">
                    Remediation completed. Waiting for a healthy follow-up check before resolution.
                  </div>
                ) : null}
                {incident.status === "resolved" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      disabled={isPending}
                      onClick={() => handleCloseIncident(incident.id)}
                      type="button"
                      variant="secondary"
                    >
                      Close
                    </Button>
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

      <Card id="recent-checks" className="space-y-2 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Checks
            </div>
            {checksPagination ? (
              <div className="text-xs text-muted-foreground">
                {checksPagination.offset + 1}-{checksPagination.offset + checksPagination.returned} / {checksPagination.total}
              </div>
            ) : null}
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
                        <div className="font-medium">{getCheckLabel(check.checkType)}</div>
                        <div className="text-muted-foreground">{check.summary}</div>
                      </div>
                      {incidentHref ? (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/12 px-2 py-0.5 text-[11px] uppercase tracking-[0.24em] text-amber-200">
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
                      className="block rounded-lg border border-border bg-card/70 p-2.5 text-sm text-foreground transition hover:border-primary/40 hover:bg-accent/55"
                      href={incidentHref}
                      key={check.id}
                    >
                      {content}
                    </a>
                  );
                }

                return (
                  <div
                    className="rounded-lg border border-border bg-card/70 p-2.5 text-sm text-foreground"
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

      <Card id="remediation-runs" className="space-y-2 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Remediation Runs
            </div>
            {runsPagination ? (
              <div className="text-xs text-muted-foreground">
                {runsPagination.offset + 1}-{runsPagination.offset + runsPagination.returned} / {runsPagination.total}
              </div>
            ) : null}
            {runs.some((run) => run.status !== "succeeded") ? (
              <div className="rounded-full border border-amber-500/30 bg-amber-500/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-200">
                Active
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isPending}
              onClick={() => {
                setShowRunsSection((current) => {
                  const next = !current;

                  if (next && !hasLoadedRuns) {
                    loadRuns(0);
                  }

                  return next;
                });
              }}
              type="button"
              variant="secondary"
            >
              {showRunsSection ? "Hide Runs" : "Show Runs"}
            </Button>
            {showRunsSection ? (
              <Button disabled={isPending} onClick={() => loadRuns(0)} type="button" variant="secondary">
                Refresh
              </Button>
            ) : null}
          </div>
        </div>

        {showRunsSection ? (
          <>
            <div className="space-y-2">
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No remediation runs loaded yet.</p>
              ) : (
                runs.map((run) => (
                  <div
                    className="rounded-lg border border-border bg-card/70 p-2.5 text-sm text-foreground"
                    id={`remediation-${run.id}`}
                    key={run.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium">{getRemediationLabel(run.actionType)}</div>
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
                        Open
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
          </>
        ) : null}
      </Card>

      <Card id="activity-feed" className="space-y-2 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Activity
            </div>
            {activityPagination ? (
              <div className="text-xs text-muted-foreground">
                {activityPagination.offset + 1}-{activityPagination.offset + activityPagination.returned} / {activityPagination.total}
              </div>
            ) : null}
            {appliedActivityKindFilter !== "all" || appliedActivityEventType ? (
              <div className="text-xs text-muted-foreground">
                {[
                  appliedActivityKindFilter !== "all" ? appliedActivityKindFilter : null,
                  appliedActivityEventType || null,
                ]
                  .filter(Boolean)
                  .join(" / ")}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isPending}
              onClick={() => setShowActivitySection((current) => !current)}
              type="button"
              variant="secondary"
            >
              {showActivitySection ? "Hide Activity" : "Show Activity"}
            </Button>
            {showActivitySection ? (
              <>
                <Button
                  disabled={isPending}
                  onClick={() => setShowActivityFilters((current) => !current)}
                  type="button"
                  variant="secondary"
                >
                  {showActivityFilters ? "Hide Filters" : "Filters"}
                </Button>
                <Button
                  disabled={isPending}
                  onClick={() => loadActivity(0)}
                  type="button"
                  variant="secondary"
                >
                  Refresh
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {showActivitySection ? (
          <>
            {showActivityFilters ? (
              <div className="grid gap-2 rounded-lg border border-border bg-card/70 p-3 lg:grid-cols-[160px_minmax(0,1fr)_auto_auto]">
                <label className="space-y-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Kind
                  <select
                    className="h-10 w-full rounded-lg border border-border bg-background/70 px-3 text-sm font-normal uppercase tracking-normal text-foreground"
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
                    className="h-10 w-full rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground placeholder:text-muted-foreground"
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
            ) : null}

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
                    className="block rounded-lg border border-border bg-card/70 p-2.5 text-sm text-foreground transition hover:border-primary/40 hover:bg-accent/55"
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
                              : getRemediationLabel(entry.payload.actionType)}
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
          </>
        ) : null}
      </Card>
    </div>
  );
}
