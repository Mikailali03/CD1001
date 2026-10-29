import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import {
  useListProperties,
  getListPropertiesQueryKey,
  type Property,
} from "@workspace/api-client-react";

export const SELECTED_PROPERTY_STORAGE_KEY = "casa-dossier.selectedPropertyId";

interface PropertyContextValue {
  properties: Property[];
  selectedProperty: Property | undefined;
  setSelectedPropertyId: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const PropertyContext = createContext<PropertyContextValue>({
  properties: [],
  selectedProperty: undefined,
  setSelectedPropertyId: () => {},
  isLoading: false,
  isError: false,
  refetch: () => {},
});

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Uses the default /api/properties key so every useListProperties() caller shares the cache
  const { data: properties = [], isLoading, isError, refetch } = useListProperties({
    query: { enabled: !!isSignedIn, queryKey: getListPropertiesQueryKey() },
  });

  // Restore the last selected property
  useEffect(() => {
    AsyncStorage.getItem(SELECTED_PROPERTY_STORAGE_KEY)
      .then((id) => { if (id) setSelectedId(id); })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const setSelectedPropertyId = useCallback((id: string) => {
    setSelectedId(id);
    AsyncStorage.setItem(SELECTED_PROPERTY_STORAGE_KEY, id).catch(() => {});
  }, []);

  // Fall back to the first property when the stored id isn't in the list (deleted, transferred, other account)
  const selectedProperty =
    properties.find((p) => p.id === selectedId) ?? properties[0];

  return (
    <PropertyContext.Provider
      value={{
        properties,
        selectedProperty,
        setSelectedPropertyId,
        isLoading: isLoading || !hydrated,
        isError,
        refetch: () => { refetch(); },
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}

export function useSelectedProperty(): PropertyContextValue {
  return useContext(PropertyContext);
}
