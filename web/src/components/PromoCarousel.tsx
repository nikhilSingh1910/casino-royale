import { useEffect, useState, type ReactNode } from 'react';
import { Bat, CricketBall, Stumps } from './CricketArt';

interface Slide {
  bg: string;
  title: ReactNode;
  sub: string;
  art: ReactNode;
}

const SLIDES: Slide[] = [
  {
    bg: 'linear-gradient(115deg, #0f3d22 0%, #1c7a45 55%, #2aa06a 100%)',
    title: (
      <>
        <span className="g">Kestrel</span> Cricket Exchange
      </>
    ),
    sub: 'Back & lay every match — play-money, all the thrill, zero risk.',
    art: <CricketBall className="promo__art" />,
  },
  {
    bg: 'linear-gradient(115deg, #123a5c 0%, #1c6236 60%, #2e8b4e 100%)',
    title: (
      <>
        Every Ball <span className="g">Counts</span>
      </>
    ),
    sub: 'Predict the next delivery — 0 to 6, wicket or extras, ball by ball.',
    art: <Stumps className="promo__art" />,
  },
  {
    bg: 'linear-gradient(115deg, #14532b 0%, #2e8b4e 55%, #17708a 100%)',
    title: (
      <>
        Trade Cricket <span className="g">Live</span>
      </>
    ),
    sub: 'Real markets, live scores, virtual chips — the exchange, on the game.',
    art: <Bat className="promo__art" />,
  },
];

export function PromoCarousel() {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const s = SLIDES[i];
  if (!s) return null;

  return (
    <div className="promo" style={{ background: s.bg }}>
      <div className="promo__text">
        <h2 className="promo__title">{s.title}</h2>
        <p className="promo__sub">{s.sub}</p>
      </div>
      {s.art}
      <div className="promo__dots">
        {SLIDES.map((_, j) => (
          <button key={j} className={`promo__dot${j === i ? ' on' : ''}`} onClick={() => setI(j)} aria-label={`Slide ${j + 1}`} />
        ))}
      </div>
    </div>
  );
}
