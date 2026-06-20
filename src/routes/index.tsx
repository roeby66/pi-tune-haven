import { createFileRoute, Navigate } from "@tanstack/react-router";
import { LoginScreen } from "@/components/LoginScreen";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — MyPiMusic" },
      { name: "description", content: "Sign in with Pi Network to access MyPiMusic." },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { status } = useAuth();
  if (status === "authenticated") {
    return <Navigate to="/home" replace />;
  }
  return <LoginScreen />;
}
