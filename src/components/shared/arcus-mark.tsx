import Image from "next/image";

export function ArcusMark({ size = 29 }: { size?: number }) {
  return <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
    <Image src="/icons/brand-64.png" alt="" width={size} height={size} priority unoptimized />
  </span>;
}
