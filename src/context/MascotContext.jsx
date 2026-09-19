import React, { createContext, useContext, useState, useEffect } from 'react';

const MascotContext = createContext({
  showSparky: true,
  toggleSparky: () => {},
  setShowSparky: () => {},
});

export function MascotProvider({ children }) {
  const [showSparky, setShowSparky] = useState(() => {
    const saved = localStorage.getItem('sguardai_mascot_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('sguardai_mascot_enabled', JSON.stringify(showSparky));
  }, [showSparky]);

  const toggleSparky = () => setShowSparky((prev) => !prev);

  return (
    <MascotContext.Provider value={{ showSparky, toggleSparky, setShowSparky }}>
      {children}
    </MascotContext.Provider>
  );
}

export function useMascot() {
  return useContext(MascotContext);
}
