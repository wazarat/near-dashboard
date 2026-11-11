import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { CompareView } from "@/components/views/compare-view";

export const metadata: Metadata = pageMeta("Compare", "/compare/");

export default function Page() {
  return <CompareView />;
}
