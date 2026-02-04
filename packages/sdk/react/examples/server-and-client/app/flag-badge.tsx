/**
 * SHARED: Safe to import from both Server and Client Components.
 * Displays a flag key, its evaluated value, and an optional live-update indicator.
 */
export default function FlagBadge({
  flagKey,
  value,
  live,
}: {
  flagKey: string;
  value: unknown;
  live?: boolean;
}) {
  const isOn = Boolean(value);
  return (
    <div className="flag-badge">
      <code className="flag-key">{flagKey}</code>
      <span className="flag-arrow">→</span>
      <span className={`flag-value ${isOn ? 'on' : 'off'}`}>{String(isOn)}</span>
      {live && <span className="flag-live">⟳ live updates</span>}
    </div>
  );
}
