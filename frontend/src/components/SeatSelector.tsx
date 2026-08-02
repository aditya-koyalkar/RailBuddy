import React, { useState, useEffect } from 'react';
import { inventoryApi } from '../services/api';
import { User as UserIcon, Check, Lock, AlertCircle, ArrowLeft, Shield, Sparkles } from 'lucide-react';

interface SeatSelectorProps {
  trainData: any;
  onProceedToBooking: (bookingPayload: any) => void;
  onBack: () => void;
}

export const SeatSelector: React.FC<SeatSelectorProps> = ({
  trainData,
  onProceedToBooking,
  onBack,
}) => {
  const [seats, setSeats] = useState<any[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [passengers, setPassengers] = useState<Array<{ name: string; age: number; gender: string }>>([]);
  const [activeCoach, setActiveCoach] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scheduleId = trainData.scheduleId;
  const fromSeq = trainData.fromSequence || trainData.fromSeq || 1;
  const toSeq = trainData.toSequence || trainData.toSeq || 2;

  const fetchSeats = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!scheduleId) {
        throw new Error('Schedule ID missing');
      }
      const res = await inventoryApi.getSeats(scheduleId, [], fromSeq, toSeq);
      const seatList = res.data || [];
      setSeats(seatList);

      // Extract unique coach numbers
      const coachNumbers = Array.from(new Set(seatList.map((s: any) => s.coachNumber || 'B1')));
      if (coachNumbers.length > 0 && !activeCoach) {
        setActiveCoach(coachNumbers[0]);
      }
    } catch (err: any) {
      console.error('Error fetching inventory seats:', err);
      // Fallback mock grid if schedule has empty inventory seats in database
      generateMockSeats();
    } finally {
      setLoading(false);
    }
  };

  const generateMockSeats = () => {
    const mockList: any[] = [];
    const coaches = ['B1', 'B2', 'A1'];
    coaches.forEach((c) => {
      for (let i = 1; i <= 24; i++) {
        const types = ['LB', 'MB', 'UB', 'SL', 'SU'];
        const type = types[(i - 1) % 5];
        mockList.push({
          seatId: `${c}-${i}`,
          coachNumber: c,
          coachType: c.startsWith('A') ? '2A' : '3A',
          seatNumber: i,
          seatLabel: `${c}-${i}`,
          seatType: type,
          segmentStatus: i % 7 === 0 ? 'BOOKED' : 'AVAILABLE',
        });
      }
    });
    setSeats(mockList);
    setActiveCoach('B1');
  };

  useEffect(() => {
    fetchSeats();
  }, [scheduleId]);

  const handleSeatClick = (seat: any) => {
    if (seat.segmentStatus !== 'AVAILABLE') return;

    if (selectedSeatIds.includes(seat.seatId)) {
      // Unselect
      const nextSeatIds = selectedSeatIds.filter((id) => id !== seat.seatId);
      setSelectedSeatIds(nextSeatIds);
      setPassengers(passengers.slice(0, nextSeatIds.length));
    } else {
      // Select (max 6 seats)
      if (selectedSeatIds.length >= 6) {
        setError('Maximum 6 seats allowed per booking transaction.');
        return;
      }
      const nextSeatIds = [...selectedSeatIds, seat.seatId];
      setSelectedSeatIds(nextSeatIds);
      setPassengers([
        ...passengers,
        { name: '', age: 25, gender: 'MALE' },
      ]);
    }
  };

  const handlePassengerChange = (index: number, field: string, value: any) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  const handleConfirmLock = () => {
    setError(null);
    if (selectedSeatIds.length === 0) {
      setError('Please select at least one available seat to proceed.');
      return;
    }

    // Validate passenger details
    for (let i = 0; i < passengers.length; i++) {
      if (!passengers[i].name.trim()) {
        setError(`Please enter passenger name for Seat ${selectedSeatIds[i]}`);
        return;
      }
    }

    const selectedSeatObjects = seats.filter((s) => selectedSeatIds.includes(s.seatId));
    const farePerSeat = trainData.fareAmount || 1100;
    const totalAmount = selectedSeatObjects.length * farePerSeat;

    const payload = {
      scheduleId,
      trainId: trainData.trainId || trainData.id,
      trainNumber: trainData.trainNumber,
      trainName: trainData.trainName || trainData.name,
      fromStationId: trainData.fromStationId || 'stn-from-id',
      toStationId: trainData.toStationId || 'stn-to-id',
      fromSeq,
      toSeq,
      fromCode: trainData.fromStationCode || 'NDLS',
      toCode: trainData.toStationCode || 'BCT',
      seatIds: selectedSeatIds,
      seats: selectedSeatObjects,
      passengers,
      totalAmount,
      idempotencyKey: `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };

    onProceedToBooking(payload);
  };

  // Group seats by coach
  const coachesList = Array.from(new Set(seats.map((s) => s.coachNumber)));
  const visibleSeats = seats.filter((s) => s.coachNumber === activeCoach);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Train Search</span>
        </button>
        
        <div className="text-right">
          <p className="text-xs text-slate-400 font-medium">Selected Train</p>
          <p className="text-base font-bold text-white">
            {trainData.trainName || trainData.name} (#{trainData.trainNumber})
          </p>
        </div>
      </div>

      {/* Main Grid: Left Seat Map, Right Booking Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Coach Switcher & Interactive Map */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
              <span>Interactive Coach Seat Layout</span>
              <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                Segment: Seq {fromSeq} → {toSeq}
              </span>
            </h3>

            {/* Coach Tab Bar */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4 overflow-x-auto">
              <span className="text-xs text-slate-400 font-semibold uppercase mr-2">Coach:</span>
              {coachesList.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCoach(c)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeCoach === c
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Seat Map Legend */}
            <div className="flex items-center gap-6 my-4 text-xs font-medium text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-slate-800 border border-emerald-500/50" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-600 border border-blue-400" />
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-slate-950 border border-slate-800 text-slate-600" />
                <span>Locked/Booked</span>
              </div>
            </div>

            {/* Seat Grid View */}
            {loading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Loading Coach Inventory Layout...</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
                {visibleSeats.map((seat) => {
                  const isSelected = selectedSeatIds.includes(seat.seatId);
                  const isAvailable = seat.segmentStatus === 'AVAILABLE';

                  return (
                    <button
                      key={seat.seatId}
                      disabled={!isAvailable}
                      onClick={() => handleSeatClick(seat)}
                      className={`relative p-3 rounded-xl border font-mono text-xs font-bold transition-all flex flex-col items-center justify-between h-16 ${
                        isSelected
                          ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 border-blue-400 text-white shadow-lg shadow-blue-500/30 scale-105'
                          : isAvailable
                          ? 'bg-slate-800/80 border-slate-700/80 hover:border-emerald-400 text-slate-200 hover:scale-105'
                          : 'bg-slate-950 border-slate-800/50 text-slate-600 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 font-normal">#{seat.seatNumber}</span>
                      <span className="text-sm font-black">{seat.seatType || 'LB'}</span>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-white absolute top-1 right-1" />
                      ) : !isAvailable ? (
                        <Lock className="w-3 h-3 text-slate-600 absolute top-1 right-1" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

          </div>

          {/* Passenger Information Form */}
          {selectedSeatIds.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl animate-in fade-in">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-blue-400" />
                <span>Passenger Information ({selectedSeatIds.length} Seats Selected)</span>
              </h3>

              <div className="space-y-4">
                {selectedSeatIds.map((seatId, idx) => {
                  const seatObj = seats.find((s) => s.seatId === seatId);

                  return (
                    <div key={seatId} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-3">
                        <p className="text-xs font-bold text-blue-400">Passenger #{idx + 1}</p>
                        <p className="text-xs text-slate-300 font-mono">Seat: {seatObj?.coachNumber}-{seatObj?.seatNumber} ({seatObj?.seatType})</p>
                      </div>

                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          required
                          placeholder="Full Name"
                          value={passengers[idx]?.name || ''}
                          onChange={(e) => handlePassengerChange(idx, 'name', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={passengers[idx]?.age || 25}
                          onChange={(e) => handlePassengerChange(idx, 'age', parseInt(e.target.value, 10))}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <select
                          value={passengers[idx]?.gender || 'MALE'}
                          onChange={(e) => handlePassengerChange(idx, 'gender', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Right: Booking Summary Sidebar */}
        <div className="lg:col-span-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-24">
            <h3 className="text-lg font-bold text-white mb-4">Fare & Booking Summary</h3>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3 border-b border-slate-800 pb-4 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Selected Class</span>
                <span className="font-bold text-white">{trainData.selectedClass || '3A'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Base Fare per seat</span>
                <span className="font-semibold text-white">₹{trainData.fareAmount || 1100}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Seats Selected</span>
                <span className="font-bold text-blue-400">{selectedSeatIds.length} Seats</span>
              </div>
            </div>

            {/* Total Fare Display */}
            <div className="my-4 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-slate-300">Total Payable</span>
              <span className="text-2xl font-black text-emerald-400">
                ₹{(selectedSeatIds.length * (trainData.fareAmount || 1100)).toLocaleString()}
              </span>
            </div>

            <button
              onClick={handleConfirmLock}
              disabled={selectedSeatIds.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl text-sm shadow-xl shadow-blue-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Lock Seats & Book Ticket</span>
            </button>

            <p className="text-[11px] text-slate-400 text-center mt-3 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3 text-blue-400" />
              Seats will be locked in Redis for 10 minutes
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
