import React, { useState, useEffect } from 'react';
import { bookingApi } from '../services/api';
import { CreditCard, AlertCircle, Clock, ExternalLink, Shield } from 'lucide-react';

interface PaymentModalProps {
  bookingPayload: any;
  onPaymentSuccess: (bookingData: any) => void;
  onCancel: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  bookingPayload,
  onCancel,
}) => {
  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [creating, setCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes lock timer

  // Step 1: Initialize booking & generate checkout session
  useEffect(() => {
    let isMounted = true;
    const initBooking = async () => {
      setCreating(true);
      setError(null);
      try {
        const res = await bookingApi.createBooking(bookingPayload);
        if (isMounted) {
          setCreatedBooking(res.data);
          const url =
            res.data?.paymentOrder?.checkoutUrl ||
            res.data?.checkoutUrl ||
            res.data?.paymentCheckoutUrl;

          // Automatically redirect to Payment Checkout if available
          if (url) {
            window.location.href = url;
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to create payment checkout session.');
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

  // Countdown timer
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

  const checkoutUrl =
    createdBooking?.paymentOrder?.checkoutUrl ||
    createdBooking?.checkoutUrl ||
    createdBooking?.paymentCheckoutUrl;

  const handleProceedToCheckout = () => {
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    } else {
      setError('Payment Checkout URL was not returned by service. Please check payment-service configuration.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 mx-auto flex items-center justify-center mb-3 shadow-lg shadow-blue-500/25">
            <CreditCard className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Payment Checkout</h2>
          <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Seats held in Redis for <span className="font-mono font-bold text-amber-400">{formatTimer(timeLeft)}</span></span>
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Creating & Redirecting State */}
        {creating && (
          <div className="py-12 text-center">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold text-white">Initializing Payment Session...</p>
            <p className="text-xs text-slate-400 mt-1">Holding seat inventory & generating secure checkout URL</p>
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
                <p className="text-xs text-slate-400">Secure 256-bit Encrypted Transaction</p>
              </div>
              <p className="text-3xl font-black text-emerald-300">₹{createdBooking.totalAmount || bookingPayload.totalAmount}</p>
            </div>

            {/* Direct Checkout Redirection Button */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleProceedToCheckout}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl text-sm shadow-xl shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
              >
                <span>Proceed and Pay</span>
                <ExternalLink className="w-4 h-4" />
              </button>

              <button
                onClick={onCancel}
                className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel & Release Seats
              </button>
            </div>

            <p className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1 pt-1">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>Redirecting to Secure Payment Gateway for Card Processing</span>
            </p>
          </div>
        )}

      </div>
    </div>
  );
};
