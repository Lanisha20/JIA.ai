// components/Header.tsx
import { useEffect, useState } from "react";

export default function Header() {
  const [stamp, setStamp] = useState<string>("--:--");

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setStamp(fmt());
    const id = setInterval(() => setStamp(fmt()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="pt-8 pb-4">
      <h1 className="h-title text-4xl md:text-5xl text-center">Potion Flow Dashboard</h1>
      <p className="text-center text-white/70 mt-2" suppressHydrationWarning>
        Live · Alchemetric Agentic Audit · <span>stamp: {stamp}</span>
      </p>
    </header>
  );
}
