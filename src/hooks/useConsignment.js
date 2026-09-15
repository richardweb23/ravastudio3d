import { useCallback, useEffect, useRef, useState } from "react";
import { loadConsignment } from "../services/consignacao.js";
export default function useConsignment(type, id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loadConsignment(type, id);
      if (version === request.current) setData(result);
    } catch (failure) { if (version === request.current) setError(failure); }
    finally { if (version === request.current) setLoading(false); }
  }, [type, id]);
  // Reinicia a consulta ao trocar o registro, conforme os módulos existentes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); return () => { request.current += 1; }; }, [reload]);
  return { data, loading, error, reload };
}
