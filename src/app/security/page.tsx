import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { SecurityView } from "@/components/views/security-view";

export const metadata: Metadata = pageMeta("Security", "/security/");

export default function Page() {
  return <SecurityView />;
}
