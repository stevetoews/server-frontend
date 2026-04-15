import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/api";

export default async function LoginPage() {
  const cookieStore = await cookies();
  let isAuthenticated = false;

  try {
    await getCurrentUser({
      cookie: cookieStore.toString(),
    });
    isAuthenticated = true;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !/authentication is required|session was not valid/i.test(error.message)
    ) {
      throw error;
    }
  }

  if (isAuthenticated) {
    redirect("/dashboard");
  }

  return (
    <div className="grid min-h-[70vh] place-items-center">
      <LoginForm />
    </div>
  );
}
