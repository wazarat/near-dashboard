import type { Metadata } from "next";
import { TractionView } from "@/components/views/traction-view";

export const metadata: Metadata = { title: "Traction" };

export default function Page() {
  return <TractionView />;
}
