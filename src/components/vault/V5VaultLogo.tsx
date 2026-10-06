export function V5VaultLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="V5Vault"
    >
      <path
        d="M50 10 L85 25 V60 C85 75 50 90 50 90 C50 90 15 75 15 60 V25 L50 10 Z"
        stroke="#00D8F6"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path
        d="M32 38 L50 68 L68 38 M38 38 L50 58 L62 38"
        stroke="#00D8F6"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
