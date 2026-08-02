import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { HomePage } from './pages/HomePage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { SeatSelectionPage } from './pages/SeatSelectionPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

function MainLayout() {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-500 selection:text-white">
      
      {/* Top Navigation */}
      <Navbar />

      {/* Global Auth Modal */}
      <AuthModal />

      {/* Main View Router */}
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/select-seats" element={<SeatSelectionPage />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />
          <Route path="/my-bookings" element={<MyBookingsPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 RailBuddy Platform. All microservices routed via API Gateway on port 4000.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>User Service :4001</span>
            <span>•</span>
            <span>Admin Service :4002</span>
            <span>•</span>
            <span>Search Service :4003</span>
            <span>•</span>
            <span>Booking Service :4004</span>
            <span>•</span>
            <span>Inventory Service :4005</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <MainLayout />
      </Router>
    </AuthProvider>
  );
}
