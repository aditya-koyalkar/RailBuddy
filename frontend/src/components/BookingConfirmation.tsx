import React from 'react';
import { CheckCircle2, Ticket, Printer, ArrowRight, Calendar, User, QrCode } from 'lucide-react';

interface BookingConfirmationProps {
  bookingData: any;
  onViewMyBookings: () => void;
  onNewSearch: () => void;
}

export const BookingConfirmation: React.FC<BookingConfirmationProps> = ({
  bookingData,
  onViewMyBookings,
  onNewSearch,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const seats = bookingData.seats || [];
  const passengers = bookingData.passengers || [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 w-full animate-in zoom-in-95">
      
      {/* Success Badge */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-3 shadow-xl shadow-emerald-500/25">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-3xl font-black text-white">Booking Confirmed!</h2>
        <p className="text-sm text-slate-300 mt-1">
          Your PNR ticket has been issued and stored in the database.
        </p>
      </div>

      {/* Printable PNR Card */}
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden print:bg-white print:text-black">
        
        {/* Top PNR Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6 print:border-slate-300">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Passenger Name Record (PNR)</span>
            <h3 className="text-3xl font-mono font-black text-blue-400 tracking-wider mt-0.5 print:text-blue-700">
              {bookingData.pnr}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
              Status: CONFIRMED
            </span>
            <div className="hidden sm:block">
              <QrCode className="w-12 h-12 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Train Details */}
        <div className="my-6 grid grid-cols-1 sm:grid-cols-3 gap-6 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 print:bg-slate-100">
          <div>
            <p className="text-xs text-slate-400">Train Details</p>
            <p className="text-base font-bold text-white print:text-black">{bookingData.trainName || 'Express'}</p>
            <p className="text-xs font-mono text-blue-400">#{bookingData.trainNumber || '12301'}</p>
          </div>

          <div>
            <p className="text-xs text-slate-400">Journey Route</p>
            <p className="text-sm font-bold text-white print:text-black flex items-center gap-2">
              <span>{bookingData.fromStationCode || 'NDLS'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              <span>{bookingData.toStationCode || 'BCT'}</span>
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-400">Date of Travel</p>
            <p className="text-sm font-bold text-white print:text-black flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>{bookingData.departureDate ? String(bookingData.departureDate).split('T')[0] : '2026-08-03'}</span>
            </p>
          </div>
        </div>

        {/* Seats & Passengers */}
        <div className="my-6">
          <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Allocated Seats & Passengers</h4>
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden print:divide-slate-300">
            {passengers.map((p: any, idx: number) => {
              const seat = seats[idx] || {};
              return (
                <div key={idx} className="p-3.5 bg-slate-800/40 flex items-center justify-between text-xs print:bg-white">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="font-bold text-white print:text-black">{p.name}</p>
                      <p className="text-[11px] text-slate-400">{p.age} yrs • {p.gender}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30 font-mono font-bold">
                      Seat: {seat.coachNumber || 'B1'}-{seat.seatNumber || idx + 1} ({seat.seatType || 'LB'})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Summary Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
          <div>
            <p className="text-slate-400">Total Amount Paid</p>
            <p className="text-xl font-black text-emerald-400">₹{bookingData.totalAmount}</p>
          </div>

          <div className="text-right text-[11px] text-slate-400">
            <p>Verified via API Gateway</p>
            <p className="text-emerald-400 font-medium">Saga Orchestration Complete</p>
          </div>
        </div>

      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 print:hidden">
        <button
          onClick={handlePrint}
          className="px-6 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 font-semibold text-sm transition-all flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Download Ticket</span>
        </button>

        <button
          onClick={onViewMyBookings}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
        >
          <Ticket className="w-4 h-4" />
          <span>View All My Bookings</span>
        </button>

        <button
          onClick={onNewSearch}
          className="px-6 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm font-semibold transition-all"
        >
          Book Another Ticket
        </button>
      </div>

    </div>
  );
};
