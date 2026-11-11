import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { SectorsView } from "@/components/views/sectors-view";

export const metadata: Metadata = pageMeta("Sectors", "/sectors/");

export default function Page() {
  return <SectorsView />;
}
