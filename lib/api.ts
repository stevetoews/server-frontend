import { getClientEnv } from "./env";

export interface ApiEnvelope<TData> {
  data: TData;
  ok: boolean;
}

export interface AuthUser {
  createdAt: string;
  email: string;
  id: string;
  role: string;
}

export interface AuthSession {
  expiresAt: string;
  issuedAt: string;
  userId: string;
}

export interface ProviderMatch {
  confidence: number;
  providerInstanceId: string;
  providerKind: "linode" | "digitalocean";
  reasons: string[];
}

export interface LinodeSnapshot {
  createdAt: string;
  cpuCores: number;
  kind: "linode";
  linodeId: string;
  planLabel: string;
  publicIpv4: string[];
  publicIpv6: string[];
  ramGb: number;
  region: string;
  summary: string;
  tags: string[];
  totalStorageGb: number;
  usedStoragePercent?: number;
}

export interface ServerRecord {
  createdAt: string;
  environment: "production" | "staging" | "development";
  hostname: string;
  id: string;
  ipAddress?: string;
  name: string;
  notes?: string;
  onboardingStatus: "draft" | "ssh_verified" | "discovered" | "provider_matched" | "active";
  osName?: string;
  osVersion?: string;
  providerMatch?: ProviderMatch;
  providerSnapshot?: LinodeSnapshot;
  spinupwpServerId?: string;
  sshAuthMode: "password" | "private_key" | "passwordless_agent";
  sshPort: number;
  sshUsername: string;
  updatedAt: string;
}

export interface OnboardingSnapshot {
  discovery: {
    architecture: string;
    distro: string;
    hostname: string;
    kernelVersion: string;
    primaryIp?: string;
  };
  nextStep: string;
  providerMatches: ProviderMatch[];
  ssh: {
    latencyMs: number;
    ok: boolean;
    target: {
      host: string;
      port: number;
      username: string;
    };
  };
}

export interface ActivationDecision {
  action: "allow" | "deny";
  reasons: string[];
}

export interface SpinupwpServerCandidate {
  label: string;
  siteCount: number;
  spinupwpServerId: string;
}

export interface HealthCheckRecord {
  checkType: string;
  createdAt: string;
  id: string;
  latencyMs?: number;
  serverId: string;
  status: "healthy" | "degraded" | "failed";
  summary: string;
}

export interface IncidentRecord {
  checkType?: string;
  id: string;
  openedAt: string;
  remediation: {
    allowedActions: Array<{
      actionType: string;
      provider: "ssh" | "linode";
      title: string;
    }>;
    reasons: string[];
  };
  resolvedAt?: string;
  serverId: string;
  severity: "warning" | "critical";
  status: "open" | "remediation_pending" | "resolved";
  summary?: string;
  title: string;
}

export interface AuditLogRecord {
  actorId?: string;
  actorType: "system" | "user";
  createdAt: string;
  eventType: string;
  id: string;
  metadata?: Record<string, unknown>;
  targetId: string;
  targetType: string;
}

export interface RemediationRunRecord {
  actionType: string;
  commandText?: string;
  finishedAt?: string;
  id: string;
  incidentId: string;
  outputSnippet?: string;
  provider: string;
  serverId: string;
  startedAt: string;
  status: "running" | "succeeded" | "failed";
}

export interface NotificationTargetRecord {
  address: string;
  channel: "email";
  createdAt: string;
  enabled: boolean;
  id: string;
  label: string;
  updatedAt: string;
}

export interface NotificationDeliveryRecord {
  bodyText: string;
  createdAt: string;
  errorMessage?: string;
  eventType: string;
  id: string;
  status: "delivered" | "failed" | "skipped";
  subject: string;
  targetId: string;
  transportKind?: "smtp" | "simulated";
  transportResponse?: string;
}

export interface PaginationMeta {
  hasMore: boolean;
  limit: number;
  offset: number;
  returned: number;
  total: number;
}

export type ServerActivityItem =
  | {
      createdAt: string;
      id: string;
      kind: "audit";
      payload: {
        actorId: string;
        actorType: string;
        eventType: string;
        metadata?: Record<string, unknown>;
        targetId?: string;
        targetType?: string;
      };
    }
  | {
      createdAt: string;
      id: string;
      kind: "incident";
      payload: IncidentRecord;
    }
  | {
      createdAt: string;
      id: string;
      kind: "remediation";
      payload: RemediationRunRecord;
    };

export interface ListOptions {
  limit?: number;
  offset?: number;
}

export interface ActivityListOptions extends ListOptions {
  cookie?: string;
  eventType?: string;
  kind?: "audit" | "incident" | "remediation";
}

function buildPaginationSearchParams(options?: ListOptions): URLSearchParams {
  const params = new URLSearchParams();

  if (typeof options?.limit === "number") {
    params.set("limit", String(options.limit));
  }

  if (typeof options?.offset === "number") {
    params.set("offset", String(options.offset));
  }

  return params;
}

export async function getHealth() {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/health`, {
    cache: "no-store",
  });

  return response.json();
}

export async function login(input: { email: string; password: string }) {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Login failed");
  }

  return payload as ApiEnvelope<{ user: AuthUser }>;
}

export async function logout() {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Logout failed");
  }

  return payload as ApiEnvelope<Record<string, never>>;
}

export async function getCurrentUser(options?: { cookie?: string }) {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/auth/me`, {
    cache: "no-store",
    headers: options?.cookie ? { cookie: options.cookie } : undefined,
    credentials: "include",
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load current user");
  }

  return payload as ApiEnvelope<{ session: AuthSession; user: AuthUser }>;
}

export async function createServer(input: {
  environment: ServerRecord["environment"];
  hostname: string;
  ipAddress?: string;
  name: string;
  notes?: string;
  sshAuthMode: ServerRecord["sshAuthMode"];
  sshPassword?: string;
  sshPort?: number;
  sshUsername: string;
}) {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/servers`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sshPort: 22,
      ...input,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to create server");
  }

  return payload as ApiEnvelope<{
    onboarding: OnboardingSnapshot;
    server: ServerRecord;
  }>;
}

export async function getServers(options?: { cookie?: string }) {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/servers`, {
    cache: "no-store",
    headers: options?.cookie ? { cookie: options.cookie } : undefined,
    credentials: "include",
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load servers");
  }

  return payload as ApiEnvelope<ServerRecord[]>;
}

export async function getServer(id: string, options?: { cookie?: string }) {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/servers/${id}`, {
    cache: "no-store",
    headers: options?.cookie ? { cookie: options.cookie } : undefined,
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load server");
  }

  return payload as ApiEnvelope<{ server: ServerRecord }>;
}

export async function activateServer(input: {
  providerInstanceId: string;
  providerKind: "linode" | "digitalocean";
  serverId: string;
}) {
  const env = getClientEnv();
  const response = await fetch(
    `${env.NEXT_PUBLIC_API_BASE_URL}/servers/${input.serverId}/activate`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerInstanceId: input.providerInstanceId,
        providerKind: input.providerKind,
      }),
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to activate server");
  }

  return payload as ApiEnvelope<{
    activation: ActivationDecision;
    nextStep: string;
    server: ServerRecord;
  }>;
}

export async function getSpinupwpCandidates(serverId: string) {
  const env = getClientEnv();
  const response = await fetch(
    `${env.NEXT_PUBLIC_API_BASE_URL}/servers/${serverId}/spinupwp-candidates`,
    {
      cache: "no-store",
      credentials: "include",
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load SpinupWP candidates");
  }

  return payload as ApiEnvelope<{
    candidates: SpinupwpServerCandidate[];
    server: ServerRecord;
  }>;
}

export async function mapSpinupwpServer(input: {
  serverId: string;
  spinupwpServerId: string;
}) {
  const env = getClientEnv();
  const response = await fetch(
    `${env.NEXT_PUBLIC_API_BASE_URL}/servers/${input.serverId}/spinupwp-map`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        spinupwpServerId: input.spinupwpServerId,
      }),
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to map SpinupWP server");
  }

  return payload as ApiEnvelope<{
    nextStep: string;
    server: ServerRecord;
  }>;
}

export async function getServerChecks(serverId: string, options?: ListOptions & { cookie?: string }) {
  const env = getClientEnv();
  const params = buildPaginationSearchParams(options);
  const response = await fetch(
    `${env.NEXT_PUBLIC_API_BASE_URL}/servers/${serverId}/checks${params.toString() ? `?${params.toString()}` : ""}`,
    {
      cache: "no-store",
      headers: options?.cookie ? { cookie: options.cookie } : undefined,
      credentials: "include",
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load server checks");
  }

  return payload as ApiEnvelope<{
    checks: HealthCheckRecord[];
    pagination?: PaginationMeta;
  }>;
}

export async function runServerChecks(serverId: string) {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/checks/run`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      serverId,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to run server checks");
  }

  return payload as ApiEnvelope<{
    checks: HealthCheckRecord[];
    pagination?: PaginationMeta;
  }>;
}

export async function getServerIncidents(serverId: string, options?: ListOptions & { cookie?: string }) {
  const env = getClientEnv();
  const params = buildPaginationSearchParams(options);
  const response = await fetch(
    `${env.NEXT_PUBLIC_API_BASE_URL}/servers/${serverId}/incidents${params.toString() ? `?${params.toString()}` : ""}`,
    {
      cache: "no-store",
      headers: options?.cookie ? { cookie: options.cookie } : undefined,
      credentials: "include",
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load server incidents");
  }

  return payload as ApiEnvelope<{
    incidents: IncidentRecord[];
    pagination?: PaginationMeta;
  }>;
}

export async function getIncidents(options?: ListOptions & { cookie?: string }) {
  const env = getClientEnv();
  const params = buildPaginationSearchParams(options);
  const response = await fetch(
    `${env.NEXT_PUBLIC_API_BASE_URL}/incidents${params.toString() ? `?${params.toString()}` : ""}`,
    {
      cache: "no-store",
      headers: options?.cookie ? { cookie: options.cookie } : undefined,
      credentials: "include",
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load incidents");
  }

  return payload as ApiEnvelope<{
    incidents: IncidentRecord[];
    pagination?: PaginationMeta;
  }>;
}

export async function getServerRemediations(serverId: string, options?: ListOptions) {
  const env = getClientEnv();
  const params = buildPaginationSearchParams(options);
  const response = await fetch(
    `${env.NEXT_PUBLIC_API_BASE_URL}/servers/${serverId}/remediations${params.toString() ? `?${params.toString()}` : ""}`,
    {
      cache: "no-store",
      credentials: "include",
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load remediation runs");
  }

  return payload as ApiEnvelope<{
    runs: RemediationRunRecord[];
    pagination?: PaginationMeta;
  }>;
}

export async function getServerActivity(
  serverId: string,
  options?: ActivityListOptions,
) {
  const env = getClientEnv();
  const params = buildPaginationSearchParams(options);

  if (options?.kind) {
    params.set("kind", options.kind);
  }

  if (options?.eventType) {
    params.set("eventType", options.eventType);
  }

  const response = await fetch(
    `${env.NEXT_PUBLIC_API_BASE_URL}/servers/${serverId}/activity${params.toString() ? `?${params.toString()}` : ""}`,
    {
      cache: "no-store",
      headers: options?.cookie ? { cookie: options.cookie } : undefined,
      credentials: "include",
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load server activity");
  }

  return payload as ApiEnvelope<{
    items: ServerActivityItem[];
    pagination?: PaginationMeta;
    server: ServerRecord;
  }>;
}

export async function getNotificationTargets(
  options?: ListOptions & { channel?: "email"; enabled?: boolean },
) {
  const env = getClientEnv();
  const params = buildPaginationSearchParams(options);

  if (options?.channel) {
    params.set("channel", options.channel);
  }

  if (typeof options?.enabled === "boolean") {
    params.set("enabled", options.enabled ? "true" : "false");
  }

  const response = await fetch(
    `${env.NEXT_PUBLIC_API_BASE_URL}/notifications/targets${
      params.toString() ? `?${params.toString()}` : ""
    }`,
    {
      cache: "no-store",
      credentials: "include",
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load notification targets");
  }

  return payload as ApiEnvelope<{
    pagination?: PaginationMeta;
    targets: NotificationTargetRecord[];
  }>;
}

export async function createNotificationTarget(input: {
  address: string;
  channel: "email";
  enabled: boolean;
  label: string;
}) {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/notifications/targets`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to create notification target");
  }

  return payload as ApiEnvelope<{
    target: NotificationTargetRecord;
  }>;
}

export async function updateNotificationTarget(input: {
  address?: string;
  enabled?: boolean;
  id: string;
  label?: string;
}) {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/notifications/targets/${input.id}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to update notification target");
  }

  return payload as ApiEnvelope<{
    target: NotificationTargetRecord;
  }>;
}

export async function deleteNotificationTarget(targetId: string) {
  const env = getClientEnv();
  const response = await fetch(
    `${env.NEXT_PUBLIC_API_BASE_URL}/notifications/targets/${targetId}/delete`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to delete notification target");
  }

  return payload as ApiEnvelope<{
    deleted: boolean;
    targetId: string;
  }>;
}

export async function getNotificationTargetDeliveries(
  targetId: string,
  options?: ListOptions & { eventType?: string; status?: "delivered" | "failed" | "skipped" },
) {
  const env = getClientEnv();
  const params = buildPaginationSearchParams(options);

  if (options?.eventType) {
    params.set("eventType", options.eventType);
  }

  if (options?.status) {
    params.set("status", options.status);
  }

  const response = await fetch(
    `${env.NEXT_PUBLIC_API_BASE_URL}/notifications/targets/${targetId}/deliveries${
      params.toString() ? `?${params.toString()}` : ""
    }`,
    {
      cache: "no-store",
      credentials: "include",
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load notification target deliveries");
  }

  return payload as ApiEnvelope<{
    deliveries: NotificationDeliveryRecord[];
    pagination?: PaginationMeta;
    target: NotificationTargetRecord;
  }>;
}

export async function remediateIncident(input: {
  actionType: string;
  incidentId: string;
}) {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/incidents/${input.incidentId}/remediate`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      actionType: input.actionType,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to remediate incident");
  }

  return payload as ApiEnvelope<{
    incidents: IncidentRecord[];
    runs: RemediationRunRecord[];
  }>;
}

export async function getIncident(incidentId: string, options?: { cookie?: string }) {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/incidents/${incidentId}`, {
    cache: "no-store",
    headers: options?.cookie ? { cookie: options.cookie } : undefined,
    credentials: "include",
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load incident");
  }

  return payload as ApiEnvelope<{
    audits: AuditLogRecord[];
    incident: IncidentRecord;
    remediations: RemediationRunRecord[];
    server: ServerRecord;
  }>;
}
