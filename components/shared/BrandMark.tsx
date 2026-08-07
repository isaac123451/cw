interface Props {
  size?: number;
  className?: string;
}

/**
 * Cardapinho — mascote da Cardápio Web.
 * Moldura roxa, rosto laranja, sobrancelhas e o bigode curvado
 * característico. Desenhado para continuar legível a 20px.
 */
export default function BrandMark({
  size = 32,
  className,
}: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Cardápio Web"
    >

      {/* Moldura */}
      <rect
        x="8"
        y="5"
        width="48"
        height="54"
        rx="15"
        fill="#7B3FBF"
      />

      {/* Rosto */}
      <rect
        x="14"
        y="11"
        width="36"
        height="42"
        rx="10"
        fill="#F9A11B"
      />

      {/* Sobrancelhas */}
      <rect
        x="19.5"
        y="17"
        width="10"
        height="3.6"
        rx="1.8"
        fill="#5B2A86"
      />
      <rect
        x="34.5"
        y="17"
        width="10"
        height="3.6"
        rx="1.8"
        fill="#5B2A86"
      />

      {/* Olhos */}
      <circle cx="24.5" cy="28" r="4.6" fill="#FFFFFF" />
      <circle cx="39.5" cy="28" r="4.6" fill="#FFFFFF" />
      <circle cx="25.3" cy="28.6" r="2.6" fill="#2B1240" />
      <circle cx="40.3" cy="28.6" r="2.6" fill="#2B1240" />

      {/* Bigode */}
      <path
        d="M32 39.5c-1.9 0-3.2-1.6-4.9-2.6-1.9-1.1-4.1-.3-4.1 1.6 0 1.5 1.3 2.4 2.6 2.1"
        fill="none"
        stroke="#5B2A86"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <path
        d="M32 39.5c1.9 0 3.2-1.6 4.9-2.6 1.9-1.1 4.1-.3 4.1 1.6 0 1.5-1.3 2.4-2.6 2.1"
        fill="none"
        stroke="#5B2A86"
        strokeWidth={2.4}
        strokeLinecap="round"
      />

      {/* Itens do cardápio */}
      <path d="M23 47.5l3.4 2-3.4 2z" fill="#E8880F" />
      <rect
        x="29"
        y="47.3"
        width="4.4"
        height="4.4"
        rx="1"
        fill="#E8880F"
      />
      <circle cx="38.6" cy="49.5" r="2.4" fill="#E8880F" />

    </svg>
  );
}
