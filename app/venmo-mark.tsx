// "venmo" written in the app's own font (not Venmo's logo, which is their trademark): plain text
// naming the service is fine, the logo artwork is not. Venmo blue on light backgrounds, white on
// blue or dark ones (blue there would be invisible). `height` is kept for existing callers and
// sets the text size relative to the surrounding text.
export function VenmoMark({ tone = 'white', height = '0.74em' }: { tone?: 'white' | 'blue'; height?: string }) {
  // The logo image was sized by its height; plain text needs about 1.35x that as its font size.
  const n = parseFloat(height) || 0.74;
  const fontSize = height.endsWith('px') ? `${Math.round(n * 1.35)}px` : `${Math.max(1, n * 1.35)}em`;
  return (
    <span
      style={{
        fontFamily: 'inherit',
        fontWeight: 800,
        fontSize,
        lineHeight: 1,
        letterSpacing: '-0.01em',
        textTransform: 'lowercase',
        color: tone === 'white' ? '#fff' : '#008CFF',
        display: 'inline',
      }}
    >
      venmo
    </span>
  );
}
