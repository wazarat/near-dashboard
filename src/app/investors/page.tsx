import type { Metadata } from "next";
import { InvestorsView } from "@/components/views/investors-view";

export const metadata: Metadata = { title: "Investors" };

export default function Page() {
  return <InvestorsView />;
}
