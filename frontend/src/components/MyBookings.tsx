import React, { useState, useEffect } from 'react';
import { bookingApi } from '../services/api';
import { Ticket, Calendar, ArrowRight, XCircle, AlertCircle, RefreshCw, CheckCircle2, Clock, User } from 'lucide-react';

export const MyBookings: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bookingApi.getUserBookings();
      setBookings(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch user bookings via API Gateway.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking ticket? Seats will be unlocked and refund will be processed.')) {
      return;
    }
    setCancellingId(bookingId);
    try {
      await bookingApi.cancelBooking(bookingId, 'Customer requested cancellation from My Bookings view');
      await fetchBookings();
    } catch (err: any) {
      alert(`Cancellation failed: ${err.message}`);
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> CONFIRMED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-xs flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> CANCELLED
          </span>
        );
      case 'PENDING':
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 animate-spin" /> PENDING
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      
      {/* Title Bar */}
      <div className="flex items-center justify-between mb-8 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Ticket className="w-7 h-7 text-blue-400" />
            <span>My Train Bookings & Tickets</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status tracking and single-click cancellation
          </p>
        </div>

        <button
          onClick={fetchBookings}
          className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          title="Refresh Bookings"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">Fetching PNR Bookings from Booking Microservice...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center my-8">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <p className="font-bold text-base text-rose-200">{error}</p>
        </div>
      )}

      {/* Empty Bookings */}
      {!loading && !error && bookings.length === 0 && (
        <div className="py-16 text-center bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">No bookings found</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
            You haven't reserved any train tickets yet. Search for available train routes to book your first ticket!
          </p>
        </div>
      )}

      {/* Bookings List */}
      {!loading && !error && bookings.length > 0 && (
        <div className="space-y-6">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden"
            >
              
              {/* Top Row: PNR & Status */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">PNR Reference</span>
                  <h3 className="text-xl font-mono font-black text-blue-400">{b.pnr}</h3>
                </div>

                <div className="flex items-center gap-4">
                  {getStatusBadge(b.status)}

                  {b.status === 'CONFIRMED' && (
                    <button
                      onClick={() => handleCancelBooking(b.id)}
                      disabled={cancellingId === b.id}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {cancellingId === b.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      <span>Cancel Ticket</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Journey Info Grid */}
              <div className="my-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-slate-400">Train</p>
                  <p className="font-bold text-white">{b.trainName || 'Express'} (#{b.trainNumber})</p>
                </div>

                <div>
                  <p className="text-slate-400">Route</p>
                  <p className="font-bold text-white flex items-center gap-2">
                    <span>{b.fromStationCode}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span>{b.toStationCode}</span>
                  </p>
                </div>

                <div>
                  <p className="text-slate-400">Departure Date</p>
                  <p className="font-bold text-white flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>{b.departureDate ? String(b.departureDate).split('T')[0] : '2026-08-03'}</span>
                  </p>
                </div>
              </div>

              {/* Passengers list */}
              {b.passengers && b.passengers.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Passengers ({b.passengers.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {b.passengers.map((p: any, pIdx: number) => (
                      <span key={pIdx} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{p.name} ({p.age}y, {p.gender})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Total */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Fare: <strong className="text-emerald-400 text-sm">₹{b.totalFare}</strong></span>
                <span className="text-[10px] text-slate-500">Booked: {new Date(b.createdAt).toLocaleDateString()}</span>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
};
