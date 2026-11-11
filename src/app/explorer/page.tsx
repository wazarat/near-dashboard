import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { ExplorerView } from "@/components/views/explorer-view";

export const metadata: Metadata = pageMeta("Explorer", "/explorer/");

export default function Page() {
  return <ExplorerView />;
}
