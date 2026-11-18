// The Venmo wordmark, used in place of the word "Venmo" on screen. White on blue or dark
// backgrounds; Venmo blue on white ones (white there would be invisible).
export function VenmoMark({ tone = 'white', height = '0.74em' }: { tone?: 'white' | 'blue'; height?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tone === 'white' ? '/venmo-wordmark-white.png' : '/venmo-wordmark-blue.png'}
      alt="Venmo"
      style={{ height, width: 'auto', display: 'inline-block', verticalAlign: '-0.02em' }}
    />
  );
}
