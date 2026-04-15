import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ServerDetailView } from "@/components/servers/server-detail-view";
import { getServer } from "@/lib/api";

interface ServerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ServerDetailPage({ params }: ServerDetailPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  let payload;

  try {
    payload = await getServer(id, {
      cookie: cookieStore.toString(),
    });
  } catch (error) {
    if (error instanceof Error && /authentication is required|session was not valid/i.test(error.message)) {
      redirect("/login");
    }

    throw error;
  }

  const server = payload.data.server;

  return <ServerDetailView server={server} />;
}
