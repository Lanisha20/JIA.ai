export async function getOverview(): Promise<any> {
    try {
      const live = await fetch("/state/overview.json", { cache: "no-store" });
      if (live.ok) return live.json();
    } catch {}
    const mock = await fetch("/overview.json", { cache: "no-store" });
    return mock.json();
  }
  