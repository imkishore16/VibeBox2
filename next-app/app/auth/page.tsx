"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignInFlow } from "@/types/auth-types";
import AuthScreen from "@/components/auth/auth-screen";
import { Suspense, useEffect } from "react";

function AuthContent() {
  const searchParams = useSearchParams();
  const formType = searchParams.get("authType") as SignInFlow || "signIn";
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session.status === "authenticated") {
      router.push("/");
    }
  }, [session.status, router]);

  if (session.status === "authenticated") {
    return null;
  }
  return <AuthScreen authType={formType} />;
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthContent />
    </Suspense>
  );
}
