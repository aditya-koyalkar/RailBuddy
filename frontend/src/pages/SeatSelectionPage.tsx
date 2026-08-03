import React, { useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SeatSelector } from '../components/SeatSelector';
import { PaymentModal } from '../components/PaymentModal';

export const SeatSelectionPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { scheduleId: paramScheduleId } = useParams<{ scheduleId: string }>();
  const [searchParams] = useSearchParams();

  // Reconstruct trainData from state OR dynamic URL parameters
  const trainData = location.state?.trainData || {
    scheduleId: paramScheduleId,
    fromSequence: Number(searchParams.get('fromSeq')) || 1,
    toSequence: Number(searchParams.get('toSeq')) || 2,
    selectedClass: searchParams.get('class') || '',
    fareAmount: Number(searchParams.get('fare')) || 0,
    fromStationCode: searchParams.get('fromCode') || '',
    toStationCode: searchParams.get('toCode') || '',
    trainName: searchParams.get('trainName') || 'Train',
    trainNumber: searchParams.get('trainNumber') || '',
  };

  const [bookingPayload, setBookingPayload] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const effectiveScheduleId = trainData?.scheduleId || paramScheduleId;

  if (!effectiveScheduleId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-base text-slate-300">No train schedule specified for seat reservation.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-md"
        >
          Go to Train Search
        </button>
      </div>
    );
  }

  const handleProceedToBooking = (payload: any) => {
    setBookingPayload(payload);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = (bookingData: any) => {
    setShowPaymentModal(false);
    navigate('/confirmation', { state: { bookingData } });
  };

  return (
    <>
      <SeatSelector
        trainData={trainData}
        onProceedToBooking={handleProceedToBooking}
        onBack={() => navigate(-1)}
      />

      {showPaymentModal && bookingPayload && (
        <PaymentModal
          bookingPayload={bookingPayload}
          onPaymentSuccess={handlePaymentSuccess}
          onCancel={() => setShowPaymentModal(false)}
        />
      )}
    </>
  );
};
