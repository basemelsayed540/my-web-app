import { Navigate } from "react-router-dom";
import { APP_ROUTES } from "../constants/routes";
import { getDefaultRouteForRole } from "../constants/roles";
import { useAuth } from "../context/AuthContext";

export function RequireRole({ children, roles }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="page-loader">Loading...</div>;
  }

  if (!user) {
    return <Navigate to={APP_ROUTES.login} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return children;
}
