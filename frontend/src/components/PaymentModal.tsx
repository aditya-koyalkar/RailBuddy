import React, { useState, useEffect } from 'react';
import { bookingApi, paymentApi } from '../services/api';
import { CreditCard, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface PaymentModalProps {
  bookingPayload: any;
  onPaymentSuccess: (bookingData: any) => void;
  onCancel: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  bookingPayload,
  onPaymentSuccess,
  onCancel,
}) => {
  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [creating, setCreating] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes timer

  // Step 1: Trigger booking creation via Gateway
  useEffect(() => {
    let isMounted = true;
    const initBooking = async () => {
      setCreating(true);
      setError(null);
      try {
        const res = await bookingApi.createBooking(bookingPayload);
        if (isMounted) {
          setCreatedBooking(res.data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to create booking transaction in Saga workflow.');
        }
      } finally {
        if (isMounted) setCreating(false);
      }
    };
    initBooking();
    return () => {
      isMounted = false;
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleVerifyPayment = async () => {
    if (!createdBooking?.bookingId) return;
    setVerifying(true);
    setError(null);
    try {
      // Gateway Payment verification
      await paymentApi.verifyPayment({
        bookingId: createdBooking.bookingId,
        paymentId: createdBooking.paymentOrder?.paymentOrderId || `pay-${Date.now()}`,
      });

      onPaymentSuccess({
        ...createdBooking,
        status: 'CONFIRMED',
        paymentStatus: 'SUCCESS',
        verifiedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err.message || 'Payment verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 mx-auto flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/25">
            <CreditCard className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Payment Checkout</h2>
          <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Seats locked for <span className="font-mono font-bold text-amber-400">{formatTimer(timeLeft)}</span></span>
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Creating Saga Loading State */}
        {creating && (
          <div className="py-12 text-center">
            <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-white">Executing Distributed Saga Workflow...</p>
            <p className="text-xs text-slate-400 mt-1">Holding Seats & Creating Payment Order via API Gateway</p>
          </div>
        )}

        {/* Payment Order Details */}
        {!creating && createdBooking && (
          <div className="space-y-4">
            
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>PNR Reference</span>
                <span className="font-mono font-bold text-blue-400 text-sm">{createdBooking.pnr}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Train</span>
                <span className="font-semibold text-white">{bookingPayload.trainName} (#{bookingPayload.trainNumber})</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Route</span>
                <span className="font-medium text-white">{bookingPayload.fromCode} → {bookingPayload.toCode}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Passengers</span>
                <span className="font-semibold text-white">{bookingPayload.passengers.length} Passenger(s)</span>
              </div>
            </div>

            {/* Price Box */}
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Total Payable Amount</p>
                <p className="text-xs text-slate-400">Includes taxes & seat reservations</p>
              </div>
              <p className="text-3xl font-black text-emerald-300">₹{createdBooking.totalAmount || bookingPayload.totalAmount}</p>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleVerifyPayment}
                disabled={verifying}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verifying ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Pay ₹{createdBooking.totalAmount || bookingPayload.totalAmount}</span>
                  </>
                )}
              </button>

              <button
                onClick={onCancel}
                className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel & Release Seats
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
