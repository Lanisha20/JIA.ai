import Image from "next/image";

export default function Poyo() {
  return (
    <div className="pointer-events-none fixed left-1/2 -translate-x-1/8 bottom-6 opacity-95">
      <Image
        src="/images/poyo.png"
        alt="Poyo"
        width={180}
        height={180}
        className="drop-shadow-[0_0_18px_rgba(244,196,113,0.35)]"
        priority
      />
    </div>
  );
}
