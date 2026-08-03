import React, { useState, useEffect, useMemo } from 'react';
import { inventoryApi } from '../services/api';
import { User as UserIcon, Check, Lock, AlertCircle, ArrowLeft, Shield, Sparkles, RefreshCw, Train } from 'lucide-react';
import { formatCoachType } from '../utils/formatters';

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
  const [allSeats, setAllSeats] = useState<any[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [passengers, setPassengers] = useState<Array<{ name: string; age: number; gender: string }>>([]);
  const [selectedClass, setSelectedClass] = useState<string>(
    trainData?.selectedClass || ''
  );
  const [activeCoach, setActiveCoach] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scheduleId = trainData?.scheduleId;
  const fromSeq = trainData?.from?.sequence || trainData?.fromSequence || trainData?.fromSeq || 1;
  const toSeq = trainData?.to?.sequence || trainData?.toSequence || trainData?.toSeq || 2;

  const fetchSeats = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!scheduleId) {
        throw new Error('Schedule ID is missing for this train selection.');
      }
      const res = await inventoryApi.getSeats(scheduleId, [], fromSeq, toSeq);
      const seatList = res.data || [];
      
      if (!Array.isArray(seatList) || seatList.length === 0) {
        setError('No seat inventory has been initialized for this train schedule yet.');
        setAllSeats([]);
        return;
      }
      
      setAllSeats(seatList);
    } catch (err: any) {
      console.error('Error fetching inventory seats:', err);
      setError(err.message || 'Failed to load seat inventory from database.');
      setAllSeats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeats();
  }, [scheduleId]);

  // Extract all distinct coach types available in this train directly from backend data
  const availableClasses = useMemo(() => {
    return Array.from(new Set(allSeats.map((s) => s.coachType).filter(Boolean)));
  }, [allSeats]);

  // Automatically select the first available coach type if initial selectedClass is empty or invalid
  useEffect(() => {
    if (availableClasses.length > 0 && (!selectedClass || !availableClasses.includes(selectedClass))) {
      setSelectedClass(availableClasses[0]);
    }
  }, [availableClasses, selectedClass]);

  // Filter seats matching current selected class
  const classSeats = useMemo(() => {
    if (!selectedClass) return allSeats;
    const filtered = allSeats.filter(
      (s) => s.coachType?.toUpperCase() === selectedClass.toUpperCase()
    );
    return filtered.length > 0 ? filtered : allSeats;
  }, [allSeats, selectedClass]);

  // List of coach numbers for the selected class (derived strictly from backend data)
  const classCoaches = useMemo(() => {
    return Array.from(new Set(classSeats.map((s) => s.coachNumber))).filter(Boolean);
  }, [classSeats]);

  // Set default active coach when classCoaches changes
  useEffect(() => {
    if (classCoaches.length > 0 && !classCoaches.includes(activeCoach)) {
      setActiveCoach(classCoaches[0]);
    }
  }, [classCoaches, activeCoach]);

  // Seats in the active coach
  const visibleCoachSeats = useMemo(() => {
    return classSeats.filter((s) => s.coachNumber === activeCoach);
  }, [classSeats, activeCoach]);

  const handleClassSwitch = (cls: string) => {
    setSelectedClass(cls);
    setSelectedSeatIds([]);
    setPassengers([]);
  };

  const handleSeatClick = (seat: any) => {
    if (seat.segmentStatus !== 'AVAILABLE') return;

    if (selectedSeatIds.includes(seat.seatId)) {
      const nextSeatIds = selectedSeatIds.filter((id) => id !== seat.seatId);
      setSelectedSeatIds(nextSeatIds);
      setPassengers(passengers.slice(0, nextSeatIds.length));
    } else {
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

  const handleQuickAutoSelect = (count: number) => {
    const available = visibleCoachSeats.filter((s) => s.segmentStatus === 'AVAILABLE');
    const toSelect = available.slice(0, Math.min(count, 6));
    const ids = toSelect.map((s) => s.seatId);
    setSelectedSeatIds(ids);
    setPassengers(ids.map(() => ({ name: '', age: 25, gender: 'MALE' })));
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

    for (let i = 0; i < passengers.length; i++) {
      if (!passengers[i].name.trim()) {
        setError(`Please enter passenger name for Seat ${selectedSeatIds[i]}`);
        return;
      }
    }

    const selectedSeatObjects = allSeats.filter((s) => selectedSeatIds.includes(s.seatId));
    const farePerSeat = Number(trainData?.fareAmount) || 0;
    const totalAmount = selectedSeatObjects.length * farePerSeat;

    const payload = {
      scheduleId,
      trainId: trainData?.trainId || trainData?.id,
      trainNumber: trainData?.trainNumber,
      trainName: trainData?.trainName || trainData?.name,
      fromStationId: trainData?.from?.stationId || trainData?.fromStationId,
      toStationId: trainData?.to?.stationId || trainData?.toStationId,
      fromSeq,
      toSeq,
      fromCode: trainData?.from?.code || trainData?.fromStationCode,
      toCode: trainData?.to?.code || trainData?.toStationCode,
      seatIds: selectedSeatIds,
      seats: selectedSeatObjects,
      passengers,
      totalAmount,
      idempotencyKey: `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };

    onProceedToBooking(payload);
  };

  // Group coach seats into bays (compartments of 8 seats) for standard coach layout
  const seatBays = useMemo(() => {
    const bays: any[][] = [];
    for (let i = 0; i < visibleCoachSeats.length; i += 8) {
      bays.push(visibleCoachSeats.slice(i, i + 8));
    }
    return bays;
  }, [visibleCoachSeats]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Search Results</span>
        </button>

        <div className="text-right">
          <p className="text-xs text-slate-400 font-medium">Selected Train & Class</p>
          <p className="text-base font-bold text-white flex items-center justify-end gap-2">
            <Train className="w-4 h-4 text-blue-400" />
            {trainData?.trainName || trainData?.name} (#{trainData?.trainNumber})
            {selectedClass && (
              <span className="ml-2 text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {formatCoachType(selectedClass)}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Class Selection Navigation Bar */}
      {availableClasses.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex items-center justify-between flex-wrap gap-4 shadow-lg">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">
              Class Filter:
            </span>
            {availableClasses.map((cls) => (
              <button
                key={cls}
                onClick={() => handleClassSwitch(cls)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedClass === cls
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {formatCoachType(cls)}
              </button>
            ))}
          </div>

          {/* Quick Auto-Select Controls */}
          {visibleCoachSeats.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Quick Select:</span>
              {[1, 2, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => handleQuickAutoSelect(num)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 hover:border-blue-500 rounded-lg text-xs font-bold transition-all"
                >
                  +{num} {num === 1 ? 'Seat' : 'Seats'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center shadow-xl">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-white">Loading Real-Time Seat Availability...</p>
          <p className="text-xs text-slate-400 mt-1">Connecting to inventory microservice</p>
        </div>
      ) : error || allSeats.length === 0 ? (
        /* Explicit Clean Error State - NO Mock Data */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-2xl mx-auto shadow-xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-rose-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Inventory Data Unavailable</h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            {error || 'No inventory record or seats found for this train schedule in the database.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onBack}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors"
            >
              Back to Search
            </button>
            <button
              onClick={fetchSeats}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Load</span>
            </button>
          </div>
        </div>
      ) : (
        /* Main Grid: Left Seat Map, Right Booking Summary */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Coach Tabs & Compartment Map */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Interactive Coach Seat Map</h3>
                <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                  Segment: Seq {fromSeq} → {toSeq}
                </span>
              </div>

              {/* Coach Switcher Tabs (Coach names strictly from backend data) */}
              {classCoaches.length > 0 && (
                <div className="flex items-center gap-2 border-b border-slate-800 pb-4 mb-4 overflow-x-auto">
                  <span className="text-xs text-slate-400 font-semibold uppercase mr-2">
                    {formatCoachType(selectedClass)} Coach:
                  </span>
                  {classCoaches.map((c) => (
                    <button
                      key={c}
                      onClick={() => setActiveCoach(c)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeCoach === c
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      Coach {c}
                    </button>
                  ))}
                </div>
              )}

              {/* Seat Legend */}
              <div className="flex items-center gap-6 my-4 text-xs font-medium text-slate-400 border-b border-slate-800/60 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-slate-800 border border-emerald-500/60" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-600 border border-blue-400" />
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-slate-950 border border-slate-800 text-slate-600" />
                  <span>Booked/Locked</span>
                </div>
              </div>

              {/* Compartment/Bay Layout View */}
              <div className="space-y-4 max-h-[520px] overflow-y-auto pr-2">
                {seatBays.map((bay, bayIdx) => (
                  <div
                    key={bayIdx}
                    className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl relative"
                  >
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Compartment Bay #{bayIdx + 1}
                    </div>

                    <div className="grid grid-cols-12 gap-3 items-center">
                      {/* Left Berths */}
                      <div className="col-span-7 grid grid-cols-3 gap-2">
                        {bay.slice(0, 6).map((seat) => {
                          const isSelected = selectedSeatIds.includes(seat.seatId);
                          const isAvailable = seat.segmentStatus === 'AVAILABLE';

                          return (
                            <button
                              key={seat.seatId}
                              disabled={!isAvailable}
                              onClick={() => handleSeatClick(seat)}
                              className={`relative p-2.5 rounded-xl border font-mono text-xs font-bold transition-all flex flex-col items-center justify-between h-14 ${
                                isSelected
                                  ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 border-blue-400 text-white shadow-lg shadow-blue-500/30 scale-105'
                                  : isAvailable
                                  ? 'bg-slate-800/80 border-slate-700 hover:border-emerald-400 text-slate-200 hover:scale-105'
                                  : 'bg-slate-950 border-slate-800/50 text-slate-600 cursor-not-allowed opacity-50'
                              }`}
                            >
                              <span className="text-[9px] text-slate-400">#{seat.seatNumber}</span>
                              <span className="text-xs font-black">{seat.seatType || `#${seat.seatNumber}`}</span>
                              {isSelected ? (
                                <Check className="w-3 h-3 text-white absolute top-1 right-1" />
                              ) : !isAvailable ? (
                                <Lock className="w-3 h-3 text-slate-600 absolute top-1 right-1" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>

                      {/* Train Aisle Indicator */}
                      <div className="col-span-1 border-r border-dashed border-slate-800 h-full flex items-center justify-center">
                        <span className="text-[9px] text-slate-600 uppercase -rotate-90 select-none font-bold">
                          Aisle
                        </span>
                      </div>

                      {/* Right Berths */}
                      <div className="col-span-4 grid grid-cols-2 gap-2">
                        {bay.slice(6, 8).map((seat) => {
                          const isSelected = selectedSeatIds.includes(seat.seatId);
                          const isAvailable = seat.segmentStatus === 'AVAILABLE';

                          return (
                            <button
                              key={seat.seatId}
                              disabled={!isAvailable}
                              onClick={() => handleSeatClick(seat)}
                              className={`relative p-2.5 rounded-xl border font-mono text-xs font-bold transition-all flex flex-col items-center justify-between h-14 ${
                                isSelected
                                  ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 border-blue-400 text-white shadow-lg shadow-blue-500/30 scale-105'
                                  : isAvailable
                                  ? 'bg-slate-800/80 border-slate-700 hover:border-emerald-400 text-slate-200 hover:scale-105'
                                  : 'bg-slate-950 border-slate-800/50 text-slate-600 cursor-not-allowed opacity-50'
                              }`}
                            >
                              <span className="text-[9px] text-slate-400">#{seat.seatNumber}</span>
                              <span className="text-xs font-black">{seat.seatType || `#${seat.seatNumber}`}</span>
                              {isSelected ? (
                                <Check className="w-3 h-3 text-white absolute top-1 right-1" />
                              ) : !isAvailable ? (
                                <Lock className="w-3 h-3 text-slate-600 absolute top-1 right-1" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Passenger Details Form */}
            {selectedSeatIds.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl animate-in fade-in">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-blue-400" />
                  <span>Passenger Details ({selectedSeatIds.length} Selected)</span>
                </h3>

                <div className="space-y-3">
                  {selectedSeatIds.map((seatId, idx) => {
                    const seatObj = allSeats.find((s) => s.seatId === seatId);

                    return (
                      <div
                        key={seatId}
                        className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                      >
                        <div className="sm:col-span-3">
                          <p className="text-xs font-bold text-blue-400">Passenger #{idx + 1}</p>
                          <p className="text-xs text-slate-300 font-mono">
                            Coach {seatObj?.coachNumber || activeCoach} - Seat #{seatObj?.seatNumber} ({seatObj?.seatType || 'Seat'})
                          </p>
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
                            onChange={(e) =>
                              handlePassengerChange(idx, 'age', parseInt(e.target.value, 10))
                            }
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

          {/* Right: Fare Summary Sidebar */}
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
                  <span className="font-bold text-white">{formatCoachType(selectedClass) || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Base Fare per seat</span>
                  <span className="font-semibold text-white">₹{Number(trainData?.fareAmount) || 0}</span>
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
                  ₹{(selectedSeatIds.length * (Number(trainData?.fareAmount) || 0)).toLocaleString()}
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
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                Seats will be locked in Redis for 10 minutes
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
