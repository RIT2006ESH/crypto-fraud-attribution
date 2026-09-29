/**
 * Inspector primitives.
 *
 * The entity and transaction drawers describe different things but share a skeleton:
 * a kicker, a title, key/value rows, stat tiles and a note. Sharing them keeps the two
 * panels visually identical in rhythm, which is what makes them read as two views of
 * the same case rather than two unrelated dialogs.
 */

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="inspector__section">
      <h4 className="inspector__section-title">{title}</h4>
      {children}
    </section>
  );
}

export function Field({ k, v, color, hint }: { k: string; v: string; color?: string; hint?: string }) {
  return (
    <div className="kv__row" title={hint}>
      <span className="kv__key">{k}</span>
      <span className="kv__val" style={color ? { color } : undefined}>
        {v}
      </span>
    </div>
  );
}

export function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="inspector__note">{children}</p>;
}

export function Actions({ children }: { children: React.ReactNode }) {
  return <div className="inspector__actions">{children}</div>;
}
