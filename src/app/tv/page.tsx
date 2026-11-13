"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TvScreen from "@/components/tv/TvScreen";

function Screen() {
  const params = useSearchParams();
  return <TvScreen tvKey={params.get("key") || ""} />;
}

export default function TvPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-bg" />}>
      <Screen />
    </Suspense>
  );
}
