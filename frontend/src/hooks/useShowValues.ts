import { useState } from "react";

const KEY = "conta-certa:show-values";

export function useShowValues() {
  const [show, setShow] = useState<boolean>(() => {
    const stored = localStorage.getItem(KEY);
    return stored === null ? true : stored === "true";
  });

  const toggle = () =>
    setShow((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, String(next));
      return next;
    });

  return { show, toggle };
}
