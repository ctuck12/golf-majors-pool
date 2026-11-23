// "Powered by Tucker App Studio" mark, drawn in code so it stays sharp and sits on any background.
export function PoweredBy({ size = 1 }: { size?: number }) {
  const s = (n: number) => Math.round(n * size * 10) / 10;
  return (
    <div
      aria-label="Powered by Tucker App Studio"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: s(10), color: '#6b7280', userSelect: 'none' }}
    >
      <span style={{ fontSize: s(15), fontWeight: 400, letterSpacing: '0.01em' }}>Powered by</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: s(8) }}>
        <span
          style={{
            width: s(18),
            height: s(24),
            border: `${s(2)}px solid #4f5bd5`,
            borderRadius: s(5),
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4f5bd5',
            fontSize: s(13),
            fontWeight: 700,
            lineHeight: 1,
            boxSizing: 'border-box',
          }}
        >
          T
        </span>
        <span style={{ fontSize: s(13), letterSpacing: '0.14em', color: '#111827', whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 800 }}>TUCKER</span> <span style={{ fontWeight: 500 }}>APP STUDIO</span>
        </span>
      </span>
    </div>
  );
}
