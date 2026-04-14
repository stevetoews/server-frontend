import { getClientEnv } from "./env";

export interface ApiEnvelope<TData> {
  data: TData;
  ok: boolean;
}

export interface AuthUser {
  email: string;
  id: string;
  role: string;
}

export interface ProviderMatch {
  confidence: number;
  providerInstanceId: string;
  providerKind: "linode" | "digitalocean";
  reasons: string[];
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
  providerMatch?: ProviderMatch;
  spinupwpServerId?: string;
  sshAuthMode: "private_key" | "passwordless_agent";
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

export interface DashboardSnapshot {
  activeServers: number;
  incidentsOpen: number;
  checksPassing: number;
  providerCoverage: string;
}

export async function getHealth() {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/health`, {
    cache: "no-store",
  });

  return response.json();
}

export function getDashboardSnapshot(): DashboardSnapshot {
  return {
    activeServers: 12,
    incidentsOpen: 3,
    checksPassing: 94,
    providerCoverage: "Linode 8 / DigitalOcean 4",
  };
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

export async function createServer(input: {
  environment: ServerRecord["environment"];
  hostname: string;
  ipAddress?: string;
  name: string;
  notes?: string;
  sshAuthMode: ServerRecord["sshAuthMode"];
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

export async function getServerChecks(serverId: string) {
  const env = getClientEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/servers/${serverId}/checks`, {
    cache: "no-store",
    credentials: "include",
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load server checks");
  }

  return payload as ApiEnvelope<{
    checks: HealthCheckRecord[];
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
  }>;
}
