"use client";

import { Check, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { nearblocksTxUrl, shortHash, verifyCommands, type AnchorCard as AnchorCardData } from "@/lib/anchor";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-ink-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
    </button>
  );
}

function Row({ label, value, copy, title }: { label: string; value: string; copy?: string; title?: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 border-b border-ink-700/40 py-1.5 last:border-0">
      <dt className="text-xs text-ink-300">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <code className="truncate font-mono text-xs text-ink-50" title={title ?? copy}>
          {value}
        </code>
        {copy && <CopyButton value={copy} label={label.toLowerCase()} />}
      </dd>
    </div>
  );
}

/**
 * The latest onchain anchor of the evidence. Each daily refresh writes a SHA-256 fingerprint of the committed
 * inputs and of the rebuilt outputs to NEAR SocialDB; this card shows that record and how to check it.
 */
export function AnchorCard({ data }: { data: AnchorCardData }) {
  const a = data.latest;
  return (
    <Card className="gap-3 py-4" data-testid="anchor-card">
      <CardHeader className="gap-1 px-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
          <ShieldCheck aria-hidden="true" className="size-4 text-signal-400" />
          Verified on NEAR
        </h3>
        <p className="text-xs text-ink-300">
          Each daily refresh writes a fingerprint of the committed evidence and of the numbers rebuilt from it to NEAR mainnet, so anyone can check that nothing on this page was edited after that day.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        {a ? (
          <>
            <dl>
              <Row label="Anchored" value={a.date} />
              <Row label="Commit" value={a.commit.slice(0, 12)} copy={a.commit} />
              <Row label="Inputs fingerprint" value={shortHash(a.inputs)} copy={a.inputs} />
              <Row label="Outputs fingerprint" value={shortHash(a.outputs)} copy={a.outputs} />
              <Row label="Verdict on that day" value={a.verdict} />
              <Row label="Signer" value={a.account} />
            </dl>
            <p className="text-xs text-ink-300">
              <a
                href={nearblocksTxUrl(a.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="anchor-tx-link"
                className="inline-flex items-center gap-1 rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                See the transaction on NearBlocks <ExternalLink aria-hidden="true" className="size-3" />
              </a>
            </p>
            <div className="space-y-1.5">
              <p className="text-xs text-ink-300">Check it yourself with three commands. A match proves the evidence existed on that date and that the published numbers come from it.</p>
              <ol className="space-y-1.5">
                {verifyCommands(a.date, a.commit).map((cmd) => (
                  <li key={cmd} className="flex items-start gap-1">
                    <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
                      <code>{cmd}</code>
                    </pre>
                    <CopyButton value={cmd} label="command" />
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <p className="text-xs text-ink-300">The first anchor has not been written yet. It appears here after the next daily refresh.</p>
        )}
      </CardContent>
    </Card>
  );
}
