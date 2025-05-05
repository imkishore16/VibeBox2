"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignInFlow } from "@/types/auth-types";
import AuthScreen from "@/components/auth/auth-screen";

export default function AuthPage() {
  const searchParams = useSearchParams();
  const formType = searchParams.get("authType") as SignInFlow || "signIn";
  const session = useSession();
  const router = useRouter();

  if (session.status === "authenticated") {
    return router.push("/");
  }
  return <AuthScreen authType={formType} />;
}
