import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { LoginScreen } from "@/components/LoginScreen";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { status } = useAuth();
  // Inline auth gate — keeps URL intact and respects Pi Browser auto-login.
  if (status !== "authenticated") return <LoginScreen />;
  return <AppShell />;
}
