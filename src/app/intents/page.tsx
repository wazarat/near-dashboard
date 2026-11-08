import type { Metadata } from "next";
import { IntentsView } from "@/components/views/intents-view";

export const metadata: Metadata = { title: "NEAR Intents" };

export default function Page() {
  return <IntentsView />;
}
