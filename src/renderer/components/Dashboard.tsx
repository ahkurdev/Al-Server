import type { ServiceStatus } from "../../shared/types";
import ServiceCard from "./ServiceCard";

export default function Dashboard({ services, onChange, notify }: { services: ServiceStatus[]; onChange: () => void; notify: (m: string) => void }) {
  const web = services.filter((s) => s.kind !== "database");
  const db = services.filter((s) => s.kind === "database");
  return (
    <div>
      <h2>Services</h2>
      <div className="grid">
        {web.map((s) => <ServiceCard key={s.name} svc={s} onChange={onChange} notify={notify} />)}
      </div>
      <h2>Databases</h2>
      <div className="grid">
        {db.map((s) => <ServiceCard key={s.name} svc={s} onChange={onChange} notify={notify} />)}
      </div>
    </div>
  );
}
