"use client";
import { Suspense } from "react";
import ModulePage from "@/components/modules/ModulePage";

export default function Page() {
  return (
    <Suspense fallback={<div className="skeleton h-[420px]" />}>
      <ModulePage slug="predictive" />
    </Suspense>
  );
}
