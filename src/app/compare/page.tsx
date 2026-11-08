import type { Metadata } from "next";
import { CompareView } from "@/components/views/compare-view";

export const metadata: Metadata = { title: "Compare" };

export default function Page() {
  return <CompareView />;
}
