import { useQuery, keepPreviousData } from "@tanstack/react-query";
import api from "@/lib/api";

/**
 * Catalogo pubblico con filtri lato API (collezione, finitura, ordinamento,
 * ricerca per nome/codice). L'API cerca con un'espressione regolare sul nome:
 * i caratteri speciali vengono neutralizzati per cercare il testo letterale.
 */
export function useProducts(filters) {
  const query = {};
  for (const [k, v] of Object.entries(filters)) if (v && v !== "all") query[k] = v;
  if (query.search) query.search = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return useQuery({
    queryKey: ["products", query],
    queryFn: async () => {
      const { data } = await api.get("/products", { params: query });
      return Array.isArray(data) ? data : [];
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
