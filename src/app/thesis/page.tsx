import type { Metadata } from "next";
import { ThesisView } from "@/components/views/thesis-view";

export const metadata: Metadata = { title: "Thesis" };

export default function Page() {
  return <ThesisView />;
}
