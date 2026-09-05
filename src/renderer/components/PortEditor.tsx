import { useState } from "react";
import type { ServiceStatus } from "../../shared/types";
import { api } from "../api";

export default function PortEditor({ svc, onChange, notify }: { svc: ServiceStatus; onChange: () => void; notify: (m: string) => void }) {
  const [port, setPort] = useState(String(svc.port));
  const [busy, setBusy] = useState(false);

  async function apply() {
    const n = Number(port);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      notify("Invalid port (1-65535)");
      return;
    }
    setBusy(true);
    try {
      const res = await api.setPort(svc.name, n);
      notify(res.message ?? "done");
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row">
      <input value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" aria-label={`${svc.label} port`} />
      <button disabled={busy} onClick={apply}>Apply port</button>
    </div>
  );
}
