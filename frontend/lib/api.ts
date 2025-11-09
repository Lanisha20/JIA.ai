// export async function getOverview(): Promise<any> {
//     try {
//       const live = await fetch("/state/overview.json", { cache: "no-store" });
//       if (live.ok) return live.json();
//     } catch {}
//     const mock = await fetch("/overview.json", { cache: "no-store" });
//     return mock.json();
//   }

// export async function getOverview() {
//     const res = await fetch("/api/overview", { cache: "no-store" });
//     if (!res.ok) {
//       throw new Error(`Backend failed: ${res.status}`);
//     }
//     return res.json();
//   }

export async function getOverview(mode: "live" | "playback" = "live", date?: string) {
    const qs = new URLSearchParams({ mode, ...(date ? { date } : {}) });
  
    console.log("[API] GET /api/overview?" + qs.toString());
    const res = await fetch("/api/overview?" + qs.toString(), { cache: "no-store" });
  
    // If the proxy isn't working, try an absolute URL by uncommenting the next two lines:
    // const res = await fetch("http://127.0.0.1:8002/api/overview?" + qs.toString(), { cache: "no-store" });
    // (If this works, your Next.js rewrite isn’t being applied / dev server needs restart)
  
    if (!res.ok) {
      const text = await res.text();
      console.error("[API] /api/overview failed:", res.status, text);
      throw new Error(`Backend failed: ${res.status}`);
    }
    const json = await res.json();
    console.log("[API] OK /api/overview →", json);
    return json;
  }
  
  
  