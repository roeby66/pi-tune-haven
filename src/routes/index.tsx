import { createFileRoute, Navigate } from "@tanstack/react-router";
import { LoginScreen } from "@/components/LoginScreen";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — MyPiMusic" },
      {
        name: "description",
        content:
          "Sign in with your Pi Network account to access MyPiMusic — the music streaming and promotion platform built exclusively for Pi Pioneers.",
      },
      { property: "og:title", content: "Sign in — MyPiMusic" },
      {
        property: "og:description",
        content:
          "Sign in with your Pi Network account to access MyPiMusic — streaming and promotion for Pi Pioneers.",
      },
      { property: "og:url", content: "https://pi-tune-haven.lovable.app/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://pi-tune-haven.lovable.app/" }],
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
