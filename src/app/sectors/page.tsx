import type { Metadata } from "next";
import { SectorsView } from "@/components/views/sectors-view";

export const metadata: Metadata = { title: "Sectors" };

export default function Page() {
  return <SectorsView />;
}
