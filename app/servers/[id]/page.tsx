import { cookies } from "next/headers";

import { ServerDetailView } from "@/components/servers/server-detail-view";
import { getServer } from "@/lib/api";

interface ServerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ServerDetailPage({ params }: ServerDetailPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const payload = await getServer(id, {
    cookie: cookieStore.toString(),
  });
  const server = payload.data.server;

  return <ServerDetailView server={server} />;
}
