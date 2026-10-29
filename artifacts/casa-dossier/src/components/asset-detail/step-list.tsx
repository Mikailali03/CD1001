// ── Step formatter ────────────────────────────────────────────────────────────
export function StepList({ description }: { description: string }) {
  const lines = description.split("\n").map((l) => l.trim()).filter(Boolean);
  const isNumbered = lines.length > 1 && lines.every((l) => /^\d+[.)]\s/.test(l));
  const isBullet = lines.length > 1 && lines.every((l) => /^[-•*]\s/.test(l));

  if (isNumbered) {
    return (
      <ol className="space-y-3">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span>{line.replace(/^\d+[.)]\s*/, "")}</span>
          </li>
        ))}
      </ol>
    );
  }
  if (isBullet) {
    return (
      <ul className="space-y-2.5">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
            <span className="shrink-0 mt-2 h-1.5 w-1.5 rounded-full bg-primary/50" />
            <span>{line.replace(/^[-•*]\s*/, "")}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{description}</p>
  );
}
