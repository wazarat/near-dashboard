import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { ThesisView } from "@/components/views/thesis-view";

export const metadata: Metadata = pageMeta("Thesis", "/thesis/");

export default function Page() {
  return <ThesisView />;
}
