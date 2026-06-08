import { createContext, useContext } from "react";

export const AuthContext = createContext({
  user: null,
  isLoading: false,
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
