"use client";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { Music2, Disc3 } from "lucide-react";

export function Appbar({ showThemeSwitch = true, isSpectator = false }) {
  const session = useSession();
  const router = useRouter();

  return (
    <div className="sticky top-0 z-50 backdrop-blur-md bg-black/20 border-b border-white/10">
      <div className="flex justify-between items-center px-5 py-4 md:px-10 xl:px-20 max-w-[1920px] mx-auto">
        {/* Logo Section */}
        <div
          onClick={() => router.push("/home")}
          className="flex items-center gap-2 group cursor-pointer"
        >
          <div className="relative">
            <Disc3 className="w-8 h-8 text-white animate-pulse group-hover:animate-spin" />
            <Music2 className="w-4 h-4 text-white absolute -top-1 -right-1" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold bg-gradient-to-r from-white via-purple-200 to-violet-200 text-transparent bg-clip-text group-hover:from-purple-200 group-hover:via-violet-200 group-hover:to-white transition-all duration-300">
              vibebox
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-medium">
              music together
            </span>
          </div>
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-4">
          {/* {isSpectator && (
            <div className="hidden sm:block">
              <WalletMultiButton />
            </div>
          )} */}
          
          {session.data?.user ? (
            <Button
              variant="ghost"
              className="bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/10"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Logout
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                className="bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/10"
                onClick={() => router.push("/auth")}
              >
                Sign in
              </Button>
              <Link
                href={{
                  pathname: "/auth",
                  query: { authType: "signUp" },
                }}
              >
                <Button
                  variant="ghost"
                  className="bg-white text-black hover:bg-white/90"
                >
                  Sign up
                </Button>
              </Link>
            </div>
          )}

          {showThemeSwitch && <ThemeSwitcher />}
          
          {/* Mobile Wallet Button */}
          {isSpectator && (
            <div className="sm:hidden">
              <WalletMultiButton />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
