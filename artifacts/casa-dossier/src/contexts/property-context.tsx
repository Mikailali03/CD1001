import { createContext, useContext, useEffect, useState } from "react";
import { useListProperties } from "@workspace/api-client-react";

type Property = {
  id: string;
  name: string;
  address: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  yearBuilt?: number | null;
  sqft?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  photoUrl?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

type PropertyContextValue = {
  activePropertyId: string | null;
  setActivePropertyId: (id: string) => void;
  activeProperty: Property | null;
  properties: Property[];
  isLoading: boolean;
};

const PropertyContext = createContext<PropertyContextValue>({
  activePropertyId: null,
  setActivePropertyId: () => {},
  activeProperty: null,
  properties: [],
  isLoading: true,
});

const STORAGE_KEY = "casa_active_property";

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const { data: properties = [], isLoading } = useListProperties();

  const [activePropertyId, setActivePropertyIdState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });

  // Auto-select first property if nothing stored or stored id no longer exists
  useEffect(() => {
    if (isLoading || properties.length === 0) return;
    const exists = properties.some((p) => p.id === activePropertyId);
    if (!exists && properties[0]) {
      setActivePropertyIdState(properties[0].id);
      localStorage.setItem(STORAGE_KEY, properties[0].id);
    }
  }, [properties, isLoading, activePropertyId]);

  function setActivePropertyId(id: string) {
    setActivePropertyIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  const activeProperty = properties.find((p) => p.id === activePropertyId) ?? null;

  return (
    <PropertyContext.Provider value={{ activePropertyId, setActivePropertyId, activeProperty, properties, isLoading }}>
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  return useContext(PropertyContext);
}
