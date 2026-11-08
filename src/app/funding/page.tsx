import type { Metadata } from "next";
import { FundingView } from "@/components/views/funding-view";

export const metadata: Metadata = { title: "Funding" };

export default function Page() {
  return <FundingView />;
}
