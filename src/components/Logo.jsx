// Logo: "I" amarilla sobre fondo blanco (industrial condensada).
export default function Logo({ size = 32, rounded = true }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="Producción Iturrospe"
      style={{ display: 'block', borderRadius: rounded ? size * 0.22 : 0, boxShadow: '0 0 0 1px var(--gris-200)' }}
    >
      <rect width="512" height="512" rx={rounded ? 96 : 0} fill="#FFFFFF" />
      <g fill="#FFC107">
        <rect x="146" y="96" width="220" height="64" rx="6" />
        <rect x="216" y="96" width="80" height="320" rx="6" />
        <rect x="146" y="352" width="220" height="64" rx="6" />
      </g>
    </svg>
  )
}
