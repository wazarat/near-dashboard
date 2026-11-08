import type { Metadata } from "next";
import { SecurityView } from "@/components/views/security-view";

export const metadata: Metadata = { title: "Security" };

export default function Page() {
  return <SecurityView />;
}
