export default function Logo({ size = 34 }) {
  return (
    <span className="logo">
      <img src="/logo-mark.png" alt="" style={{ width: size, height: size }} />
      <span>Tasxity<i>.</i></span>
    </span>
  );
}
