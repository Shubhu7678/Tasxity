export default function Mountain({ className = '' }) {
  return (
    <svg className={`mountain ${className}`} viewBox="0 0 800 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1626" />
          <stop offset=".55" stopColor="#6b3f55" />
          <stop offset=".85" stopColor="#e8935a" />
          <stop offset="1" stopColor="#f6c38b" />
        </linearGradient>
        <linearGradient id="peak" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd9b0" />
          <stop offset=".5" stopColor="#8b5a6e" />
          <stop offset="1" stopColor="#2a2233" />
        </linearGradient>
        <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2d2433" />
          <stop offset="1" stopColor="#0e0c12" />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill="url(#sky)" />
      <path d="M0 330 L120 250 L210 290 L360 120 L420 170 L470 110 L620 270 L700 230 L800 300 V400 H0Z" fill="url(#peak)" />
      <path d="M0 360 C150 320 250 350 400 335 C560 320 650 355 800 330 V400 H0Z" fill="url(#base)" />
    </svg>
  );
}
