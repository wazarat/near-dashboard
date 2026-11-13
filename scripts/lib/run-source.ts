/**
 * Runs one source and records its status in _meta.json's perSource entry. A source writes its history files only
 * after it has everything it needs, so a source that throws leaves its last good data on disk untouched; its status
 * keeps lastSuccess from the last good run and records the error, and the site keeps building from the old data.
 */
import { isoNow } from "../../src/lib/dates";
import type { SourceStatus } from "../../src/lib/history-types";
import type { Ctx, Source } from "../fetch/context";

export type SourceOutcome = { kind: "ok" | "skipped" | "failed"; line: string };

export async function runSource(s: Pick<Source, "run">, ctx: Ctx, st: SourceStatus, now: () => string = isoNow): Promise<SourceOutcome> {
  st.lastAttempt = now();
  st.error = null;
  st.skipped = null;
  st.notes = [];
  const started = Date.now();
  try {
    const r = await s.run(ctx);
    st.ms = Date.now() - started;
    st.rows = r.rows;
    st.calls = r.calls;
    st.bytes = r.bytes ?? 0;
    st.notes = r.notes;
    const sk = r.notes.find((n) => n.startsWith("skipped:"));
    if (sk) {
      st.skipped = sk.replace(/^skipped:\s*/, "");
      return { kind: "skipped", line: `skipped (${st.skipped})` };
    }
    st.lastSuccess = now();
    return { kind: "ok", line: `ok  ${String(r.rows).padStart(7)} rows  ${String(r.calls).padStart(4)} calls  ${(st.ms / 1000).toFixed(1)}s${r.bytes ? `  ${(r.bytes / 1e9).toFixed(2)} GB` : ""}` };
  } catch (e) {
    st.ms = Date.now() - started;
    st.error = (e as Error).message.slice(0, 300);
    return { kind: "failed", line: `FAILED  ${st.error}` };
  }
}
