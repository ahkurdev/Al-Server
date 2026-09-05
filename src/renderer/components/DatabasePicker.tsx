import type { ServiceStatus } from "../../shared/types";
import { api } from "../api";

const DBS = ["mysql", "mariadb", "postgresql"] as const;

export default function DatabasePicker({ services, onChange, notify }: { services: ServiceStatus[]; onChange: () => void; notify: (m: string) => void }) {
  async function toggleDb(name: (typeof DBS)[number]) {
    const svc = services.find((s) => s.name === name);
    if (!svc) return;
    if (!svc.enabled) {
      const res = await api.setEnabled(name, true);
      notify(res.message ?? "done");
    } else if (svc.state === "running") {
      const res = await api.stop(name);
      notify(res.message ?? "done");
    } else {
      const res = await api.start(name);
      notify(res.message ?? "done");
    }
    await onChange();
  }

  return (
    <section className="panel">
      <h2>Database picker</h2>
      <p className="muted">Bisa jalan lebih dari satu bersamaan, asal beda port.</p>
      <div className="row">
        {DBS.map((db) => {
          const svc = services.find((s) => s.name === db);
          const on = svc?.state === "running";
          return (
            <button key={db} className={on ? "btn-on" : ""} onClick={() => toggleDb(db)}>
              {svc?.label ?? db}: {on ? "running" : "off"} ({svc?.port})
            </button>
          );
        })}
      </div>
    </section>
  );
}
