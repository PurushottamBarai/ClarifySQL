export default function BrandLogo({ height = 28, className = '' }) {
  return (
    <span className={`brand-logo ${className}`.trim()} style={{ height }}>
      <img
        src="/logo.png"
        alt="ClarifySQL"
        className="brand-logo-img brand-logo-for-light"
      />
      <img
        src="/logo-light.png"
        alt=""
        aria-hidden="true"
        className="brand-logo-img brand-logo-for-dark"
      />
    </span>
  );
}
