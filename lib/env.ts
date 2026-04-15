export function getClientEnv() {
  const isServer = typeof window === "undefined";
  const serverApiBaseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api`
    : "http://localhost:3000/api";

  return {
    NEXT_PUBLIC_API_BASE_URL: isServer ? serverApiBaseUrl : "/api",
  };
}
