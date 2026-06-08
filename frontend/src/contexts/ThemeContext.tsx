import React, { createContext, useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Verificar localStorage
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) return stored;

    // Verificar preferência do sistema
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }

    return "dark";
  });

  useEffect(() => {
    const htmlElement = document.documentElement;
    if (theme === "light") {
      htmlElement.classList.remove("dark");
      htmlElement.classList.add("light");
    } else {
      htmlElement.classList.add("dark");
      htmlElement.classList.remove("light");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
