import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import React from "react";
import { LayoutDashboard } from "lucide-react";

const Header = () => {
  return (
    <div>
      <header className="fixed top-0 w-full border-b bg-background/80 backdrop-blur-md z-50 px-4 py-2 flex items-center justify-between supports-[backdrop-filter]: bg-background/60">
        <nav>
          <Link href="/">
            <Image
              src="/logo.png"
              width={100}
              height={40}
              alt="PrepGenius Logo"
              className="h-12 py-1 w-auto object-contain"
            />
          </Link>
          <div>
            <SignedIn>
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Industrial Insights
              </Link>
            </SignedIn>
          </div>
        </nav>
        {/* Show the sign-in and sign-up buttons when the user is signed out */}
        <SignedOut>
          <SignInButton />
          <SignUpButton>
            <button className="bg-[#6c47ff] text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 cursor-pointer">
              Sign Up
            </button>
          </SignUpButton>
        </SignedOut>
        {/* Show the user button when the user is signed in */}
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>
    </div>
  );
};

export default Header;
