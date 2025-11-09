import Image from "next/image";

export default function Deer() {
  return (
    <div className="pointer-events-none fixed right-6 top-6 opacity-65">
      <Image
        src="/images/deer-head.png"
        alt="Mystical Deer"
        width={180}
        height={180}
        className="drop-shadow-[0_0_24px_rgba(158,124,253,0.35)]"
        priority
      />
    </div>
  );
}
