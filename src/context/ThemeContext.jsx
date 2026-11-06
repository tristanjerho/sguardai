import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Clear any legacy dark mode stored from automatic OS dark detection
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (localStorage.getItem('sguardai_theme') === 'dark') {
          localStorage.removeItem('sguardai_theme');
        }
      }
    } catch {
      // ignore
    }

    // Check if the user manually toggled the theme during this active browser session
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const sessionTheme = sessionStorage.getItem('sguardai_session_theme');
        if (sessionTheme === 'light' || sessionTheme === 'dark') {
          return sessionTheme;
        }
      }
    } catch {
      // ignore
    }

    // Default must unconditionally be the original white (light mode)
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('sguardai_session_theme', theme);
      }
      // Also sync to localStorage so any other tabs stay consistent
      if (typeof window !== 'undefined' && window.localStorage) {
        if (theme === 'light') {
          localStorage.removeItem('sguardai_theme');
        }
      }
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

