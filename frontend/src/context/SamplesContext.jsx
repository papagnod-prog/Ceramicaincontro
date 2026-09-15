import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

const SamplesContext = createContext(null);
const STORAGE_KEY = "ci_samples_v1";
export const MAX_SAMPLES = 5;

export const SamplesProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addSample = (product) => {
    if (items.some((i) => i.product_id === product.id)) {
      toast.info(`${product.name} è già nella tua lista campioni`);
      return;
    }
    if (items.length >= MAX_SAMPLES) {
      toast.error(`Puoi richiedere al massimo ${MAX_SAMPLES} campioni gratuiti`);
      return;
    }
    setItems((prev) => [
      ...prev,
      { product_id: product.id, name: product.name, collection: product.collection, image: product.image },
    ]);
    toast.success(`${product.name} aggiunto alla richiesta campioni`);
  };

  const removeSample = (productId) => setItems((prev) => prev.filter((i) => i.product_id !== productId));
  const clear = () => setItems([]);

  return (
    <SamplesContext.Provider value={{ items, addSample, removeSample, clear, count: items.length }}>
      {children}
    </SamplesContext.Provider>
  );
};

export const useSamples = () => useContext(SamplesContext);
