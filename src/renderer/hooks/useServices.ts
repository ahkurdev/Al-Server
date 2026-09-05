import { useCallback, useEffect, useState } from "react";
import type { ServiceName, ServiceStatus } from "../../shared/types";
import { api } from "../api";

export function useServices() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      setServices(await api.listServices());
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const act = useCallback(async (name: ServiceName, op: "start" | "stop" | "restart") => {
    const res = await api[op](name);
    setNotice(res.message ?? (res.success ? "ok" : "failed"));
    await refresh();
  }, [refresh]);

  return { services, loading, notice, refresh, act, setNotice };
}
