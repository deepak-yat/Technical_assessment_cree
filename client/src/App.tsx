import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { Layout } from './components/layout/Layout.js';
import { ProtectedRoute, RoleRoute } from './routes/RouteGuards.js';

// Guest Pages
import { RoomsPage } from './pages/guest/RoomsPage.js';
import { AvailabilitySearchPage } from './pages/guest/AvailabilitySearchPage.js';
import { RoomDetailPage } from './pages/guest/RoomDetailPage.js';
import { MyReservationsPage } from './pages/guest/MyReservationsPage.js';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage.js';
import { RegisterPage } from './pages/auth/RegisterPage.js';

// Staff Pages
import { DashboardPage } from './pages/staff/DashboardPage.js';
import { FrontDeskPage } from './pages/staff/FrontDeskPage.js';
import { ReservationManagementPage } from './pages/staff/ReservationManagementPage.js';
import { RoomManagementPage } from './pages/staff/RoomManagementPage.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                {/* Public Guest Routes */}
                <Route index element={<RoomsPage />} />
                <Route path="search" element={<AvailabilitySearchPage />} />
                <Route path="rooms/:id" element={<RoomDetailPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />

                {/* Protected Guest Route */}
                <Route
                  path="my-reservations"
                  element={
                    <ProtectedRoute>
                      <MyReservationsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Protected Staff & Admin Routes */}
                <Route
                  path="staff/dashboard"
                  element={
                    <RoleRoute roles={['STAFF', 'ADMIN']}>
                      <DashboardPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="staff/front-desk"
                  element={
                    <RoleRoute roles={['STAFF', 'ADMIN']}>
                      <FrontDeskPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="staff/reservations"
                  element={
                    <RoleRoute roles={['STAFF', 'ADMIN']}>
                      <ReservationManagementPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="staff/rooms"
                  element={
                    <RoleRoute roles={['STAFF', 'ADMIN']}>
                      <RoomManagementPage />
                    </RoleRoute>
                  }
                />

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
