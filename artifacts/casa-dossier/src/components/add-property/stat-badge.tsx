export function StatBadge({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | null;
}) {
  if (value == null) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </p>
        <p className="font-semibold text-sm leading-tight">{value}</p>
      </div>
    </div>
  );
}
