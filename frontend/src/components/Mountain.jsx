export default function Mountain({ className = '' }) {
  return (
    <svg className={`mountain ${className}`} viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="glow" cx="50%" cy="0%" r="75%">
          <stop offset="0" stopColor="#7c7ff8" stopOpacity=".38" />
          <stop offset="1" stopColor="#7c7ff8" stopOpacity="0" />
        </radialGradient>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#fff" strokeOpacity=".05" />
        </pattern>
      </defs>
      <rect width="800" height="400" fill="#000" />
      <rect width="800" height="400" fill="url(#grid)" />
      <rect width="800" height="400" fill="url(#glow)" />
    </svg>
  );
}
