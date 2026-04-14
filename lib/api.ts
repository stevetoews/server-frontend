import { getClientEnv } from "./env";

export interface ApiEnvelope<TData> {
  data: TData;
  ok: boolean;
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
