import React, { useState, useEffect } from 'react';
import { searchApi, inventoryApi } from '../services/api';
import { Train, Clock, ArrowRight, Shield, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';

interface SearchResultsProps {
  fromCode: string;
  toCode: string;
  journeyDate: string;
  selectedClassFilter: string;
  onSelectTrainSchedule: (trainData: any) => void;
  onBack: () => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  fromCode,
  toCode,
  journeyDate,
  selectedClassFilter,
  onSelectTrainSchedule,
  onBack,
}) => {
  const [trains, setTrains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, any>>({});

  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await searchApi.searchTrains(fromCode, toCode, journeyDate);

      // Admin-service returns: { success: true, data: { trains: [...], from, to, date, count } }
      const rawData = (res as any).data;
      const trainList: any[] = Array.isArray(rawData?.trains) ? rawData.trains : [];

      setTrains(trainList);

      // Fetch inventory availability for each schedule
      const availabilities: Record<string, any> = {};
      for (const t of trainList) {
        if (t.scheduleId) {
          try {
            const availRes = await inventoryApi.getAvailability(t.scheduleId);
            if (availRes.data) {
              availabilities[t.scheduleId] = availRes.data;
            }
          } catch (e) {
            console.warn(`Could not fetch availability for schedule ${t.scheduleId}:`, e);
          }
        }
      }
      setAvailabilityMap(availabilities);
    } catch (err: any) {
      setError(err.message || 'Failed to search trains. Ensure backend services are running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [fromCode, toCode, journeyDate]);

  const formatMinutes = (mins?: number) => {
    if (mins === undefined || mins === null) return '--:--';
    const hrs = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${hrs.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 bg-slate-900/80 border border-slate-800 p-4 sm:p-6 rounded-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
            <button onClick={onBack} className="hover:text-blue-400 underline">Search</button>
            <span>/</span>
            <span className="text-blue-400">Results</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <span>{fromCode}</span>
            <ArrowRight className="w-5 h-5 text-blue-400" />
            <span>{toCode}</span>
            <span className="text-sm font-normal text-slate-400 ml-2">({journeyDate})</span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchResults}
            className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Refresh Search"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Modify Search
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-base font-semibold text-white">Searching Train Routes via API Gateway...</p>
          <p className="text-xs text-slate-400 mt-1">Connecting to Search & Inventory Microservices</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center my-8">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <p className="font-bold text-lg text-rose-200">Unable to load train routes</p>
          <p className="text-sm text-rose-300/80 mt-1">{error}</p>
          <button
            onClick={fetchResults}
            className="mt-4 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && trains.length === 0 && (
        <div className="py-16 text-center bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
          <Train className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">No trains found for this route</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
            No active schedules matching <span className="text-blue-400 font-semibold">{fromCode} → {toCode}</span> on {journeyDate}. Try creating a train & schedule in the Admin Dashboard!
          </p>
        </div>
      )}

      {/* Train list */}
      {!loading && !error && trains.length > 0 && (
        <div className="space-y-6">
          {trains.map((t) => {
            const avail = availabilityMap[t.scheduleId];
            const hasSchedule = Boolean(t.scheduleId);

            return (
              <div
                key={t.scheduleId || t.trainId || t.trainNumber}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 shadow-xl transition-all"
              >
                {/* Train Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono font-bold text-xs">
                        #{t.trainNumber}
                      </span>
                      <h3 className="text-lg font-bold text-white">{t.trainName}</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span>Runs on this route</span>
                      <span>•</span>
                      {hasSchedule ? (
                        <span className="text-emerald-400 font-medium">
                          Schedule: {avail?.status || t.scheduleStatus || 'ACTIVE'}
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium">
                          No schedule on {journeyDate}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-medium">Departure</p>
                      <p className="text-sm font-bold text-white">{formatMinutes(t.from?.departureMinute)}</p>
                      <p className="text-xs text-slate-400">{t.from?.code || fromCode}</p>
                    </div>

                    <div className="flex flex-col items-center">
                      <Clock className="w-4 h-4 text-slate-500 mb-1" />
                      <div className="w-16 h-0.5 bg-slate-700 relative">
                        <div className="w-2 h-2 rounded-full bg-blue-500 absolute -top-0.75 left-1/2 -translate-x-1/2" />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 font-medium">Arrival</p>
                      <p className="text-sm font-bold text-white">{formatMinutes(t.to?.arrivalMinute)}</p>
                      <p className="text-xs text-slate-400">{t.to?.code || toCode}</p>
                    </div>
                  </div>
                </div>

                {/* No schedule warning */}
                {!hasSchedule && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>This train runs on this route but has no active schedule for <strong>{journeyDate}</strong>. Create a schedule in the Admin Dashboard to enable booking.</span>
                  </div>
                )}

                {/* Coach Class Cards Grid */}
                {hasSchedule && (() => {
                  // Dynamically extract classes ONLY from actual train configuration (fares & coaches)
                  const configuredFares = t.fares || [];
                  const fareClassTypes = configuredFares.map((f: any) => f.coachType?.toUpperCase());
                  const coachClassTypes = (t.coaches || []).map((c: any) => c.coachType?.toUpperCase());
                  
                  const classList: string[] = Array.from(
                    new Set([...fareClassTypes, ...coachClassTypes].filter(Boolean))
                  );

                  if (classList.length === 0) {
                    return (
                      <div className="mt-4 p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 text-slate-400 text-xs">
                        No coach classes or fares configured for this train yet.
                      </div>
                    );
                  }

                  const primaryClass = classList[0];
                  const primaryFareObj = configuredFares.find((f: any) => f.coachType?.toUpperCase() === primaryClass);
                  const primaryFare = primaryFareObj ? Number(primaryFareObj.fare) : 0;

                  return (
                    <>
                      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {classList.map((cls) => {
                          if (selectedClassFilter !== 'ALL' && selectedClassFilter !== cls) return null;

                          const fareObj = configuredFares.find((f: any) => f.coachType?.toUpperCase() === cls);
                          const fareAmount = fareObj ? Number(fareObj.fare) : 0;

                          return (
                            <div
                              key={cls}
                              onClick={() => onSelectTrainSchedule({ ...t, selectedClass: cls, fareAmount })}
                              className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 hover:border-blue-500 cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between group"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">{cls}</span>
                                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  Available
                                </span>
                              </div>

                              <div className="mt-3 flex items-end justify-between">
                                <div>
                                  <p className="text-[10px] text-slate-400">Fare per seat</p>
                                  <p className="text-base font-extrabold text-white">
                                    {fareAmount > 0 ? `₹${fareAmount}` : 'N/A'}
                                  </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Bottom Action Footer */}
                      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-blue-400" />
                          Distributed Saga Protected
                        </span>
                        <button
                          onClick={() => onSelectTrainSchedule({ ...t, selectedClass: primaryClass, fareAmount: primaryFare })}
                          className="text-blue-400 font-semibold hover:text-blue-300 flex items-center gap-1"
                        >
                          <span>Select Seats & Book</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  );
                })()}

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
