import { createContext, useState, useCallback } from "react";

export const AppStateContext = createContext();

export function AppStateProvider({ children }) {
  const [customizedState, setCustomizedState] = useState({
    audioFile: null,
    data: [],
    selectedPreset: "music",
    scalingBands: {},
    outputTimeData: null,
    processedData: null,
    maxFrequency: 20000,
  });

  const updateCustomizedState = useCallback((updates) => {
    setCustomizedState((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const clearCustomizedState = useCallback(() => {
    setCustomizedState({
      audioFile: null,
      data: [],
      selectedPreset: "music",
      scalingBands: {},
      outputTimeData: null,
      processedData: null,
      maxFrequency: 20000,
    });
  }, []);

  return (
    <AppStateContext.Provider value={{ customizedState, updateCustomizedState, clearCustomizedState }}>
      {children}
    </AppStateContext.Provider>
  );
}
