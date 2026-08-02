import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookingConfirmation } from '../components/BookingConfirmation';

export const ConfirmationPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const bookingData = location.state?.bookingData;

  if (!bookingData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-base text-slate-300">No booking details found.</p>
        <button
          onClick={() => navigate('/my-bookings')}
          className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-md"
        >
          View My Bookings
        </button>
      </div>
    );
  }

  return (
    <BookingConfirmation
      bookingData={bookingData}
      onViewMyBookings={() => navigate('/my-bookings')}
      onNewSearch={() => navigate('/')}
    />
  );
};
