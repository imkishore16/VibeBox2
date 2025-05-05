"use client";
import React, { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignInFlow } from "@/types/auth-types";

interface SigninCardProps {
  setFormType: (state: SignInFlow) => void;
}

export default function SigninCard({ setFormType: setState }: SigninCardProps) {
  const router = useRouter();
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
  }>({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!credentials.email || !credentials.password) {
      toast.error("Please fill all the fields");
      return;
    }

    try {
      setLoading(true);
      const res = await signIn("credentials", {
        redirect: false,
        email: credentials.email,
        password: credentials.password,
        callbackUrl: "/home",
      });
      if (res?.error) {
        setError(res.error);
      }
      if (res?.url) {
        router.push(res.url);
      }
    } catch (err) {
      toast.error(
        (err as Error).message || "Something went wrong, please try again"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignin = async () => {
    try {
      setLoading(true);
      const res = await signIn("google", {
        redirect: false,
        callbackUrl: "/home",
      });
      if (res?.error) {
        setError(res.error);
      }
      if (res?.url) {
        router.push(res.url);
      }
    } catch (err) {
      toast.error(
        (err as Error).message || "Something went wrong, please try again"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials({
      ...credentials,
      [name]: value,
    });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Card className="h-full w-full border-purple-600 bg-gray-800 bg-opacity-50 p-8">
      <CardHeader className="w-full">
        <CardTitle className="text-center text-3xl font-bold text-white">
          Login to vibebox
        </CardTitle>
      </CardHeader>
      {!!error && (
        <div className="mb-6 flex w-full items-center gap-x-2 rounded-md bg-destructive p-3 text-sm text-white">
          <TriangleAlert className="size-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      <CardContent className="space-y-6 px-0 pb-0">
        <form 
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
        >
          <div>
            <label className="mb-2 block text-sm font-bold text-white">
              Email
            </label>
            <Input
              name="email"
              type="email"
              placeholder="Email"
              value={credentials.email}
              onChange={handleInputChange}
              className="border-gray-400 bg-transparent text-white placeholder:text-gray-400 focus-visible:ring-purple-600 focus-visible:ring-offset-0"
              required
            />
          </div>
          <div className="relative">
            <label className="mb-2 block text-sm font-bold text-white">
              Password
            </label>
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={credentials.password}
              onChange={handleInputChange}
              className="border-gray-400 bg-transparent text-white placeholder:text-gray-400 focus-visible:ring-purple-600 focus-visible:ring-offset-0"
              required
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute right-2 top-9 text-gray-400"
            >
              {showPassword ? (
                <EyeOffIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            {loading ? "Signing In..." : "Continue"}
          </Button>
        </form>
        <Separator className="bg-gradient-to-r from-gray-800 via-neutral-500 to-gray-800" />
        <div className="flex flex-col items-center gap-y-2.5">
          <Button
            disabled={loading}
            onClick={handleGoogleSignin}
            size="lg"
            className="relative w-full bg-white text-black hover:bg-white/90"
          >
            <FcGoogle className="absolute left-2.5 top-3 size-5" />
            Continue with Google
          </Button>
          <p className="text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <span
              className="cursor-pointer text-sky-700 hover:underline"
              onClick={() => setState("signUp")}
            >
              Sign up
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
