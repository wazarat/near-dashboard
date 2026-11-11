import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { TractionView } from "@/components/views/traction-view";

export const metadata: Metadata = pageMeta("Traction", "/traction/");

export default function Page() {
  return <TractionView />;
}
