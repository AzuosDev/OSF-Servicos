import { createContext, useCallback, useContext, useState } from "react";

interface AuthContextValue {
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  isLocked: true,
  lock: () => {},
  unlock: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const lock = useCallback(() => setIsLocked(true), []);
  const unlock = useCallback(() => setIsLocked(false), []);
  return (
    <AuthContext.Provider value={{ isLocked, lock, unlock }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
