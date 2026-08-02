import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../services/api';
import { Shield, Plus, Train, MapPin, Calendar, DollarSign, Layers, RefreshCw, CheckCircle2, AlertCircle, ArrowDown } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { isAdmin } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'stations' | 'trains' | 'routes' | 'fares' | 'schedules'>('stations');

  // Data states
  const [stations, setStations] = useState<any[]>([]);
  const [trains, setTrains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Modals / Input states
  // Station Form
  const [stationName, setStationName] = useState('');
  const [stationCode, setStationCode] = useState('');
  const [stationCity, setStationCity] = useState('');
  const [stationState, setStationState] = useState('');

  // Train Form
  const [trainNumber, setTrainNumber] = useState('');
  const [trainName, setTrainName] = useState('');
  const [coachesInput, setCoachesInput] = useState<Array<{ coachNumber: string; coachType: string; seatCount: number }>>([
    { coachNumber: 'C1', coachType: 'GENERAL', seatCount: 24 },
    { coachNumber: 'FC1', coachType: 'FIRST_CLASS', seatCount: 18 },
  ]);

  // Route Form
  const [routeTrainId, setRouteTrainId] = useState('');
  const [routeStops, setRouteStops] = useState<Array<{ stationId: string; sequence: number; arrivalMinute: number; departureMinute: number }>>([
    { stationId: '', sequence: 1, arrivalMinute: 0, departureMinute: 10 },
    { stationId: '', sequence: 2, arrivalMinute: 180, departureMinute: 190 },
    { stationId: '', sequence: 3, arrivalMinute: 360, departureMinute: 370 },
  ]);

  const addRouteStop = () => {
    setRouteStops((prev) => [
      ...prev,
      {
        stationId: '',
        sequence: prev.length + 1,
        arrivalMinute: prev.length * 180,
        departureMinute: prev.length * 180 + 10,
      },
    ]);
  };

  const removeRouteStop = (index: number) => {
    if (routeStops.length <= 2) return;
    setRouteStops((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, sequence: i + 1 }))
    );
  };

  const resetRouteForm = () => {
    setRouteTrainId('');
    setRouteStops([
      { stationId: '', sequence: 1, arrivalMinute: 0, departureMinute: 10 },
      { stationId: '', sequence: 2, arrivalMinute: 180, departureMinute: 190 },
      { stationId: '', sequence: 3, arrivalMinute: 360, departureMinute: 370 },
    ]);
  };

  const handleSelectTrainForRoute = (trainId: string) => {
    setRouteTrainId(trainId);
    if (!trainId) {
      resetRouteForm();
      return;
    }
    const selectedTrain = trains.find((t) => t.id === trainId);
    if (selectedTrain?.route?.stops && selectedTrain.route.stops.length > 0) {
      const existingStops = selectedTrain.route.stops.map((stop: any, idx: number) => ({
        stationId: stop.stationId,
        sequence: stop.sequence || (idx + 1),
        arrivalMinute: stop.arrivalMinute ?? 0,
        departureMinute: stop.departureMinute ?? 0,
      }));
      setRouteStops(existingStops);
    } else {
      setRouteStops([
        { stationId: '', sequence: 1, arrivalMinute: 0, departureMinute: 10 },
        { stationId: '', sequence: 2, arrivalMinute: 180, departureMinute: 190 },
        { stationId: '', sequence: 3, arrivalMinute: 360, departureMinute: 370 },
      ]);
    }
  };

  const addCoach = () => {
    setCoachesInput((prev) => [
      ...prev,
      { coachNumber: `C${prev.length + 1}`, coachType: 'GENERAL', seatCount: 24 },
    ]);
  };

  const removeCoach = (index: number) => {
    if (coachesInput.length <= 1) return;
    setCoachesInput((prev) => prev.filter((_, i) => i !== index));
  };

  // Schedule Form
  const [schedTrainId, setSchedTrainId] = useState('');
  const [schedDepartureDate, setSchedDepartureDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });

  // Fare Form
  const [fareTrainId, setFareTrainId] = useState('');
  const [fareFromStn, setFareFromStn] = useState('');
  const [fareToStn, setFareToStn] = useState('');
  const [fareGeneral, setFareGeneral] = useState(500);
  const [fareFirstClass, setFareFirstClass] = useState(1800);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stnRes, trnRes] = await Promise.allSettled([
        adminApi.getStations(),
        adminApi.getTrains(),
      ]);

      if (stnRes.status === 'fulfilled') {
        setStations(stnRes.value.data || []);
      }
      if (trnRes.status === 'fulfilled') {
        setTrains(trnRes.value.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
          <Shield className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-rose-200">Admin Access Restricted</h2>
          <p className="text-sm text-rose-300/80 mt-1">
            You are logged in as a standard passenger. Only users with <code className="bg-rose-950 px-2 py-0.5 rounded text-rose-300">isAdmin: true</code> can access the Admin Dashboard.
          </p>
        </div>
      </div>
    );
  }

  // Station Creation
  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      await adminApi.createStation({
        name: stationName,
        code: stationCode.toUpperCase(),
        city: stationCity,
        state: stationState,
      });
      setSuccessMsg(`Station ${stationCode.toUpperCase()} created successfully!`);
      setStationName('');
      setStationCode('');
      setStationCity('');
      setStationState('');
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to create station.');
    }
  };

  // Train Creation
  const handleCreateTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Format coaches with seats
    const formattedCoaches = coachesInput.map((c) => {
      const seatsArr = [];
      const types = ['LOWER', 'UPPER'];
      for (let i = 1; i <= c.seatCount; i++) {
        seatsArr.push({
          seatNumber: i,
          seatLabel: `${c.coachNumber}-${i}`,
          seatType: types[(i - 1) % 2],
        });
      }
      return {
        coachNumber: c.coachNumber,
        coachType: c.coachType,
        seats: seatsArr,
      };
    });

    try {
      await adminApi.createTrain({
        trainNumber,
        name: trainName,
        coaches: formattedCoaches,
      });
      setSuccessMsg(`Train #${trainNumber} (${trainName}) created successfully with ${formattedCoaches.length} coaches!`);
      setTrainNumber('');
      setTrainName('');
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to create train.');
    }
  };

  // Route Creation
  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!routeTrainId) {
      setError('Please select a train to assign route');
      return;
    }

    try {
      await adminApi.createRoute({
        trainId: routeTrainId,
        stops: routeStops.map((s, idx) => ({
          stationId: s.stationId,
          sequence: idx + 1,
          arrivalMinute: Number(s.arrivalMinute) || 0,
          departureMinute: Number(s.departureMinute) || 0,
          arrivalDay: 1,
          departureDay: 1,
          haltMinutes: Math.max(0, (Number(s.departureMinute) || 0) - (Number(s.arrivalMinute) || 0)),
        })),
      });
      setSuccessMsg('Train Route created / updated successfully!');
      resetRouteForm();
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to create route.');
    }
  };

  // Fares Creation
  const handleCreateFares = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!fareTrainId || !fareFromStn || !fareToStn) {
      setError('Please select Train, From Station, and To Station');
      return;
    }

    const faresList = [
      { fromStationId: fareFromStn, toStationId: fareToStn, coachType: 'GENERAL', fare: Number(fareGeneral) },
      { fromStationId: fareFromStn, toStationId: fareToStn, coachType: 'FIRST_CLASS', fare: Number(fareFirstClass) },
    ];

    try {
      await adminApi.createFares({
        trainId: fareTrainId,
        fares: faresList,
      });
      setSuccessMsg('Train fares initialized successfully!');
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize fares.');
    }
  };

  // Schedule Creation
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!schedTrainId) {
      setError('Please select a train to schedule');
      return;
    }

    try {
      await adminApi.createSchedule({
        trainId: schedTrainId,
        departureDate: schedDepartureDate,
        status: 'ACTIVE',
      });
      setSuccessMsg(`Train schedule created for date ${schedDepartureDate}! Outbox events triggered.`);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to create schedule.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-800/50 p-6 rounded-2xl mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">
            <Shield className="w-4 h-4" />
            <span>Admin Service Management</span>
          </div>
          <h2 className="text-2xl font-bold text-white">RailBuddy System Control Panel</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage stations, trains, routes, coach layouts, fares, and active schedules via API Gateway.
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          className="px-4 py-2 rounded-xl bg-purple-900/40 border border-purple-700/50 text-purple-300 hover:text-white text-xs font-semibold flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 mb-8 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('stations')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'stations'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Stations ({stations.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('trains')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'trains'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Train className="w-4 h-4" />
          <span>Trains ({trains.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('routes')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'routes'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Route Builder</span>
        </button>

        <button
          onClick={() => setActiveSubTab('fares')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'fares'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Fare Matrix</span>
        </button>

        <button
          onClick={() => setActiveSubTab('schedules')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'schedules'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Create Schedule</span>
        </button>
      </div>

      {/* 1. Stations Manager */}
      {activeSubTab === 'stations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Create Station Form */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" />
              <span>Add New Station</span>
            </h3>

            <form onSubmit={handleCreateStation} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Station Code (e.g. NDLS)</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={stationCode}
                  onChange={(e) => setStationCode(e.target.value)}
                  placeholder="NDLS"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono text-white placeholder-slate-500 uppercase focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Station Name</label>
                <input
                  type="text"
                  required
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  placeholder="New Delhi Central"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={stationCity}
                    onChange={(e) => setStationCity(e.target.value)}
                    placeholder="New Delhi"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={stationState}
                    onChange={(e) => setStationState(e.target.value)}
                    placeholder="Delhi"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/20 transition-all"
              >
                Create Station Entry
              </button>
            </form>
          </div>

          {/* Stations List */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
              <span>All Railway Stations</span>
              <span className="text-xs text-purple-400 font-semibold">{stations.length} Total</span>
            </h3>

            {stations.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No stations added yet.</p>
            ) : (
              <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
                {stations.map((s) => (
                  <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">{s.name}</p>
                      <p className="text-slate-400">{s.city}, {s.state}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono font-bold">
                      {s.code}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* 2. Trains Manager */}
      {activeSubTab === 'trains' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Create Train Form */}
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" />
              <span>Create Train & Coach Layout</span>
            </h3>

            <form onSubmit={handleCreateTrain} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Train Number</label>
                  <input
                    type="text"
                    required
                    value={trainNumber}
                    onChange={(e) => setTrainNumber(e.target.value)}
                    placeholder="12301"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Train Name</label>
                  <input
                    type="text"
                    required
                    value={trainName}
                    onChange={(e) => setTrainName(e.target.value)}
                    placeholder="Rajdhani Express"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Coaches Config */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-300">Coach Configurations</label>
                  <button
                    type="button"
                    onClick={addCoach}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all"
                  >
                    + Add Coach
                  </button>
                </div>
                <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-3">
                  <span className="col-span-3 text-center">Coach No</span>
                  <span className="col-span-5">Coach Type</span>
                  <span className="col-span-3 text-center">Seats Count</span>
                  <span className="col-span-1"></span>
                </div>
                <div className="space-y-2">
                  {coachesInput.map((c, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/80 grid grid-cols-12 gap-2 text-xs items-center">
                      <input
                        type="text"
                        value={c.coachNumber}
                        onChange={(e) => {
                          const updated = [...coachesInput];
                          updated[idx].coachNumber = e.target.value;
                          setCoachesInput(updated);
                        }}
                        className="col-span-3 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono text-center font-bold"
                      />

                      <select
                        value={c.coachType}
                        onChange={(e) => {
                          const updated = [...coachesInput];
                          updated[idx].coachType = e.target.value;
                          setCoachesInput(updated);
                        }}
                        className="col-span-5 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                      >
                        <option value="GENERAL">GENERAL</option>
                        <option value="FIRST_CLASS">FIRST_CLASS</option>
                      </select>

                      <input
                        type="number"
                        min={6}
                        max={72}
                        value={c.seatCount}
                        onChange={(e) => {
                          const updated = [...coachesInput];
                          updated[idx].seatCount = parseInt(e.target.value, 10) || 24;
                          setCoachesInput(updated);
                        }}
                        className="col-span-3 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono text-center font-bold"
                      />

                      <div className="col-span-1 text-center">
                        {coachesInput.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCoach(idx)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded font-bold transition-colors"
                            title="Remove Coach"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/20 transition-all"
              >
                Save Train & Generate Seats
              </button>
            </form>
          </div>

          {/* Trains List */}
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">Configured Trains</h3>

            {trains.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No trains added yet.</p>
            ) : (
              <div className="space-y-3 max-h-[450px] overflow-y-auto">
                {trains.map((t) => (
                  <div key={t.id} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white">{t.name}</span>
                      <span className="font-mono bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded">
                        #{t.trainNumber}
                      </span>
                    </div>
                    <p className="text-slate-400">
                      Coaches: {t.coaches?.map((c: any) => c.coachNumber).join(', ') || '3A/2A'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* 3. Route Builder */}
      {activeSubTab === 'routes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Route Editor Form (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                <span>{routeTrainId ? 'Edit Train Station Route' : 'Define Train Station Route'}</span>
              </h3>
              {routeTrainId && (
                <button
                  type="button"
                  onClick={resetRouteForm}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Clear Selection
                </button>
              )}
            </div>

            <form onSubmit={handleCreateRoute} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Select Train to Configure</label>
                <select
                  value={routeTrainId}
                  onChange={(e) => handleSelectTrainForRoute(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
                >
                  <option value="">-- Choose Train --</option>
                  {trains.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (#{t.trainNumber}) {t.route?.stops?.length ? `[${t.route.stops.length} Stops Configured]` : '[No Route]'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stops array */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">Station Stops Sequence</label>
                    <p className="text-[10px] text-slate-400">Time format: Minutes from midnight (e.g. 0 = 12:00 AM, 360 = 06:00 AM, 1200 = 08:00 PM)</p>
                  </div>
                  <button
                    type="button"
                    onClick={addRouteStop}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all"
                  >
                    + Add Station Stop
                  </button>
                </div>

                {/* Column Header Row */}
                <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-purple-300 uppercase tracking-wider px-3 pt-1">
                  <span className="col-span-1 text-center">Stop</span>
                  <span className="col-span-6">Station Name & Code</span>
                  <span className="col-span-2 text-center">Arr (Min)</span>
                  <span className="col-span-2 text-center">Dep (Min)</span>
                  <span className="col-span-1"></span>
                </div>

                <div className="space-y-1">
                  {routeStops.map((stop, idx) => (
                    <React.Fragment key={idx}>
                      <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 grid grid-cols-12 gap-2 text-xs items-center shadow-md">
                        <div className="col-span-1 flex items-center justify-center">
                          <span className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold font-mono text-xs flex items-center justify-center shadow-inner">
                            #{idx + 1}
                          </span>
                        </div>

                        <select
                          value={stop.stationId}
                          onChange={(e) => {
                            const updated = [...routeStops];
                            updated[idx].stationId = e.target.value;
                            setRouteStops(updated);
                          }}
                          className="col-span-6 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs truncate focus:outline-none focus:border-purple-500"
                        >
                          <option value="">-- Select Station --</option>
                          {stations.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code}) - {s.city}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          placeholder="0"
                          value={stop.arrivalMinute}
                          onChange={(e) => {
                            const updated = [...routeStops];
                            updated[idx].arrivalMinute = parseInt(e.target.value, 10) || 0;
                            setRouteStops(updated);
                          }}
                          className="col-span-2 px-2 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-center font-mono focus:outline-none focus:border-purple-500"
                        />

                        <input
                          type="number"
                          placeholder="10"
                          value={stop.departureMinute}
                          onChange={(e) => {
                            const updated = [...routeStops];
                            updated[idx].departureMinute = parseInt(e.target.value, 10) || 0;
                            setRouteStops(updated);
                          }}
                          className="col-span-2 px-2 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-center font-mono focus:outline-none focus:border-purple-500"
                        />

                        <div className="col-span-1 text-center">
                          {routeStops.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeRouteStop(idx)}
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg font-bold transition-colors"
                              title="Remove Stop"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Connecting Flow Arrow */}
                      {idx < routeStops.length - 1 && (
                        <div className="flex items-center justify-center py-1">
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-purple-400 text-xs font-semibold shadow-sm">
                            <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Train Route Flow</span>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/20 transition-all"
                >
                  Save Train Route Stops
                </button>
                <button
                  type="button"
                  onClick={resetRouteForm}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-all"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>

          {/* Configured Routes List (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
              <span>Train Route Timelines</span>
              <span className="text-xs text-purple-400 font-semibold">{trains.filter((t) => t.route?.stops?.length).length} Configured</span>
            </h3>

            {trains.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No trains registered.</p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {trains.map((t) => {
                  const hasRoute = t.route?.stops && t.route.stops.length > 0;
                  const stops = t.route?.stops || [];
                  const originStn = stops[0]?.station?.code || 'START';
                  const destStn = stops[stops.length - 1]?.station?.code || 'END';

                  return (
                    <div
                      key={t.id}
                      className={`p-4 rounded-xl border transition-all ${
                        routeTrainId === t.id
                          ? 'bg-purple-950/40 border-purple-500 shadow-lg shadow-purple-500/10'
                          : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-bold text-white text-sm">{t.name}</h4>
                          <span className="font-mono text-[11px] text-purple-300 font-bold">#{t.trainNumber}</span>
                        </div>
                        <button
                          onClick={() => handleSelectTrainForRoute(t.id)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 text-xs font-semibold transition-all"
                        >
                          {hasRoute ? 'Edit Route' : '+ Add Route'}
                        </button>
                      </div>

                      {hasRoute ? (
                        <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span className="font-mono font-bold text-emerald-400">{originStn}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{stops.length} Station Stops</span>
                            <span className="font-mono font-bold text-blue-400">{destStn}</span>
                          </div>
                          
                          {/* Mini Stops Timeline */}
                          <div className="flex items-center gap-1 overflow-x-auto py-1">
                            {stops.map((st: any, sIdx: number) => (
                              <React.Fragment key={st.id || sIdx}>
                                <span
                                  title={`${st.station?.name || st.stationId} (Arr: ${st.arrivalMinute}m, Dep: ${st.departureMinute}m)`}
                                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300 shrink-0"
                                >
                                  {st.station?.code || `Stn-${sIdx+1}`}
                                </span>
                                {sIdx < stops.length - 1 && (
                                  <span className="text-[10px] text-purple-400 font-bold">→</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic mt-2">No route stops configured yet.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* 4. Fare Matrix */}
      {activeSubTab === 'fares' && (
        <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>Setup Coach Fares Between Station Pair</span>
          </h3>

          <form onSubmit={handleCreateFares} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Train</label>
              <select
                value={fareTrainId}
                onChange={(e) => setFareTrainId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">-- Choose Train --</option>
                {trains.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (#{t.trainNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">From Station</label>
                <select
                  value={fareFromStn}
                  onChange={(e) => setFareFromStn(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="">Select Station</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">To Station</label>
                <select
                  value={fareToStn}
                  onChange={(e) => setFareToStn(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="">Select Station</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">GENERAL Fare (₹)</label>
                <input
                  type="number"
                  value={fareGeneral}
                  onChange={(e) => setFareGeneral(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-bold"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">FIRST_CLASS Fare (₹)</label>
                <input
                  type="number"
                  value={fareFirstClass}
                  onChange={(e) => setFareFirstClass(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/20 transition-all"
            >
              Initialize Fares Matrix
            </button>
          </form>
        </div>
      )}

      {/* 5. Schedule Generator */}
      {activeSubTab === 'schedules' && (
        <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            <span>Create Train Schedule for Date</span>
          </h3>

          <form onSubmit={handleCreateSchedule} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Train</label>
              <select
                value={schedTrainId}
                onChange={(e) => setSchedTrainId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">-- Choose Train --</option>
                {trains.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (#{t.trainNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Departure Date</label>
              <input
                type="date"
                required
                value={schedDepartureDate}
                onChange={(e) => setSchedDepartureDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/20 transition-all"
            >
              Generate Active Schedule
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
