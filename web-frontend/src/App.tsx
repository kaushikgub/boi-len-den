import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { CatalogPage } from './pages/CatalogPage';
import { BookDetailPage } from './pages/BookDetailPage';
import { MyRentalsPage } from './pages/MyRentalsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { AdminBooksPage } from './pages/AdminBooksPage';
import { Role } from './api/types';

/** A protected page wrapped in the app shell, optionally role-gated. */
function Protected({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected><CatalogPage /></Protected>} />
      <Route path="/books/:id" element={<Protected><BookDetailPage /></Protected>} />
      <Route path="/rentals" element={<Protected><MyRentalsPage /></Protected>} />
      <Route path="/payments" element={<Protected><PaymentsPage /></Protected>} />
      <Route
        path="/admin/books"
        element={
          <Protected roles={['librarian', 'admin']}>
            <AdminBooksPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
