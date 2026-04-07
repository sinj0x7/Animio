/** Same mark as `public/favicon.svg` — pink “i” + sky “o” on dark tile. */

interface AnimioMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

export function AnimioMark({ size = 32, className, title }: AnimioMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="9" fill="#0B0C10" />
      <circle cx="10.5" cy="9.5" r="2.4" fill="#ffb7c5" />
      <rect x="8.25" y="13.5" width="4.5" height="11" rx="2.25" fill="#ffb7c5" />
      <circle
        cx="22.5"
        cy="19"
        r="6.25"
        fill="none"
        stroke="#87ceeb"
        strokeWidth="3.4"
      />
    </svg>
  );
}
