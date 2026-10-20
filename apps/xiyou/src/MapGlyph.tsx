/** Small cartographic marks share the series linework and token colours. */
export function MapGlyph({
  kind,
}: {
  kind: 'flag' | 'wood' | 'water' | 'home' | 'erase' | 'undo';
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={`expedition-glyph expedition-glyph--${kind}`}
    >
      {kind === 'flag' && <path d="M12 35V6M13 7Q21 2 30 8L27 18Q20 13 13 19M8 35H18" />}
      {kind === 'wood' && (
        <>
          <path d="M11 29V35M28 27V35M5 24L11 8L17 24ZM20 22L28 4L36 22ZM18 28L23 17M3 36Q20 32 37 36" />
          <path d="M7 17H15M24 14H32" />
        </>
      )}
      {kind === 'water' && (
        <path d="M4 12Q10 6 16 12T28 12T38 12M2 22Q8 16 14 22T26 22T38 22M4 32Q10 26 16 32T28 32T38 32" />
      )}
      {kind === 'home' && (
        <>
          <path d="M3 18L19 7L36 18M7 17V33H32V17M14 33V24H22V33M3 34H36" />
          <path d="M8 19H31M11 13L27 13" />
        </>
      )}
      {kind === 'erase' && (
        <>
          <path d="M10 12L28 12L26 34H12ZM7 9H32M15 9V5H24V9M17 17V29M22 17V29" />
        </>
      )}
      {kind === 'undo' && <path d="M8 20V8M8 20H20M9 19Q17 3 29 15T25 34" />}
    </svg>
  );
}
