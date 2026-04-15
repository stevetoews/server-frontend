export function getClientEnv() {
  const isServer = typeof window === "undefined";
  const serverApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

  return {
    NEXT_PUBLIC_API_BASE_URL: isServer ? serverApiBaseUrl : "/api",
  };
}
