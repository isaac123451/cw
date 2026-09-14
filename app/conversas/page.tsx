"use client";

import { Suspense } from "react";

import MainLayout from "@/components/layout/MainLayout";

import Conversas from "@/components/conversas/Conversas";

export default function ConversasPage() {
  return (
    <MainLayout>
      {/* useSearchParams suspende o render; sem o Suspense a página inteira vira dinâmica. */}
      <Suspense fallback={null}>
        <Conversas />
      </Suspense>
    </MainLayout>
  );
}
