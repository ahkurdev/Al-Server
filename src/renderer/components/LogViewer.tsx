import { useEffect, useRef, useState } from "react";
import type { ServiceName } from "../../shared/types";
import { api } from "../api";

export default function LogViewer({ service }: { service: ServiceName }) {
  const [text, setText] = useState("");
  const [name, setName] = useState<ServiceName>(service);
  const boxRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const t = await api.logTail(name);
      if (alive) setText(t);
    }
    load();
    const timer = setInterval(load, 2000);
    return () => { alive = false; clearInterval(timer); };
  }, [name]);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  return (
    <section className="panel">
      <h2>Logs</h2>
      <div className="row">
        <select value={name} onChange={(e) => setName(e.target.value as ServiceName)} aria-label="log service">
          {["apache", "nginx", "php-fpm", "mysql", "mariadb", "postgresql"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={async () => { await api.logClear(name); setText(""); }}>Clear</button>
      </div>
      <pre ref={boxRef} className="logbox">{text || "(empty)"}</pre>
    </section>
  );
}
