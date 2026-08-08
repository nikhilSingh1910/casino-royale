// Simple, original cricket motifs as inline SVG — no external images (CSP-safe, self-contained).

export function CricketBall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" role="img" aria-label="cricket ball">
      <defs>
        <radialGradient id="ballShine" cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#e8574a" />
          <stop offset="60%" stopColor="#c0392b" />
          <stop offset="100%" stopColor="#8e2b20" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="38" fill="url(#ballShine)" stroke="#7a241b" strokeWidth="1.5" />
      <path d="M22 40 Q50 52 78 40" stroke="#f6e7c9" strokeWidth="2.4" strokeDasharray="2 4" strokeLinecap="round" fill="none" />
      <path d="M22 60 Q50 48 78 60" stroke="#f6e7c9" strokeWidth="2.4" strokeDasharray="2 4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Stumps({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" role="img" aria-label="stumps">
      <rect x="31" y="22" width="17" height="4.5" rx="2.2" fill="#f2b705" />
      <rect x="52" y="22" width="17" height="4.5" rx="2.2" fill="#f2b705" />
      <rect x="34" y="26" width="7" height="54" rx="3.5" fill="#ecc987" />
      <rect x="46.5" y="26" width="7" height="54" rx="3.5" fill="#ecc987" />
      <rect x="59" y="26" width="7" height="54" rx="3.5" fill="#ecc987" />
    </svg>
  );
}

export function Bat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" role="img" aria-label="bat and ball">
      <g transform="rotate(24 50 50)">
        <rect x="46" y="12" width="8" height="26" rx="4" fill="#7c5327" />
        <rect x="38" y="36" width="24" height="50" rx="9" fill="#ecc987" stroke="#c9a35e" strokeWidth="1.5" />
      </g>
      <circle cx="26" cy="30" r="11" fill="#c0392b" stroke="#7a241b" strokeWidth="1.2" />
      <path d="M17 27 Q26 32 35 27" stroke="#f6e7c9" strokeWidth="1.6" strokeDasharray="1.5 3" fill="none" />
    </svg>
  );
}
