import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "../features/admin/AdminPage";
import { QueriesPage } from "../features/queries/QueriesPage";
import { RepPage } from "../features/rep/RepPage";
import { SenderPage } from "../features/sender/SenderPage";
import { LoginPage } from "../features/login/LoginPage";
import { RequireRole } from "./RequireRole";
import { APP_ROUTES } from "../constants/routes";
import { ROLES } from "../constants/roles";

export function AppRoutes() {
  return (
    <Routes>
      <Route path={APP_ROUTES.login} element={<LoginPage />} />
      <Route
        path={APP_ROUTES.rep}
        element={
          <RequireRole roles={[ROLES.rep, ROLES.admin]}>
            <RepPage />
          </RequireRole>
        }
      />
      <Route
        path={APP_ROUTES.admin}
        element={
          <RequireRole roles={[ROLES.admin]}>
            <AdminPage />
          </RequireRole>
        }
      />
      <Route
        path={APP_ROUTES.queries}
        element={
          <RequireRole roles={[ROLES.admin, ROLES.queries, ROLES.inquiry, ROLES.inquiryArabic]}>
            <QueriesPage />
          </RequireRole>
        }
      />
      <Route
        path={APP_ROUTES.sender}
        element={
          <RequireRole roles={[ROLES.sender, ROLES.merchant, ROLES.senderArabic]}>
            <SenderPage />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to={APP_ROUTES.rep} replace />} />
    </Routes>
  );
}
