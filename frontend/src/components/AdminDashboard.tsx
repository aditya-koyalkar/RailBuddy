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

    if (fareFromStn === fareToStn) {
      setError('Origin and Destination stations cannot be the same station.');
      return;
    }

    const selectedTrain = trains.find((t) => t.id === fareTrainId);
    const stops = selectedTrain?.route?.stops || [];
    if (stops.length > 0) {
      const fromStop = stops.find((s: any) => s.stationId === fareFromStn);
      const toStop = stops.find((s: any) => s.stationId === fareToStn);
      if (fromStop && toStop && fromStop.sequence >= toStop.sequence) {
        setError(`Invalid direction! Fares can only follow the forward train route flow (Stop #${fromStop.sequence} → Stop #${toStop.sequence} is invalid).`);
        return;
      }
    }

    const coachTypes = Array.from(
      new Set((selectedTrain?.coaches || []).map((c: any) => c.coachType).filter(Boolean))
    );

    const faresList = (coachTypes.length > 0 ? coachTypes : ['GENERAL', 'FIRST_CLASS']).map((ct: any) => ({
      fromStationId: fareFromStn,
      toStationId: fareToStn,
      coachType: ct,
      fare: ct === 'FIRST_CLASS' ? Number(fareFirstClass) : Number(fareGeneral),
    }));

    try {
      await adminApi.createFares({
        trainId: fareTrainId,
        fares: faresList,
      });
      setSuccessMsg('Train fares saved successfully!');
      setFareFromStn('');
      setFareToStn('');
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

    if (!schedTrainId || !schedDepartureDate) {
      setError('Please select a train and departure date');
      return;
    }

    const selectedTrain = trains.find((t) => t.id === schedTrainId);
    if (!selectedTrain?.route?.stops || selectedTrain.route.stops.length === 0) {
      setError(`Cannot schedule ${selectedTrain?.name || 'train'}: Train has no route stops configured. Please define a route in the Route Builder first.`);
      return;
    }

    const isAlreadyScheduled = selectedTrain.schedules?.some((sch: any) => {
      const existingDate = new Date(sch.departureDate).toISOString().split('T')[0];
      return existingDate === schedDepartureDate;
    });

    if (isAlreadyScheduled) {
      setError(`Schedule for ${selectedTrain.name} on date ${schedDepartureDate} already exists! Multiple schedules on the same day are prohibited.`);
      return;
    }

    try {
      await adminApi.createSchedule({
        trainId: schedTrainId,
        departureDate: schedDepartureDate,
        status: 'ACTIVE',
      });
      setSuccessMsg(`Active schedule created for ${selectedTrain.name} on ${schedDepartureDate}! Outbox event triggered.`);
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
      {activeSubTab === 'fares' && (() => {
        const selectedTrain = trains.find((t) => t.id === fareTrainId);
        
        // Derive route stations if train route exists, else fallback to all stations
        const routeStops = selectedTrain?.route?.stops || [];
        const trainRouteStations = routeStops.length > 0
          ? routeStops
              .map((st: any) => st.station || stations.find((s) => s.id === st.stationId))
              .filter(Boolean)
          : stations;

        // Group fares by (fromStationId, toStationId)
        const faresMap: Record<string, { fromStn: any; toStn: any; general?: number; firstClass?: number }> = {};
        if (selectedTrain?.fares) {
          selectedTrain.fares.forEach((f: any) => {
            const key = `${f.fromStationId}_${f.toStationId}`;
            if (!faresMap[key]) {
              const fromS = stations.find((s) => s.id === f.fromStationId);
              const toS = stations.find((s) => s.id === f.toStationId);
              faresMap[key] = { fromStn: fromS, toStn: toS };
            }
            if (f.coachType === 'GENERAL') faresMap[key].general = f.fare;
            if (f.coachType === 'FIRST_CLASS') faresMap[key].firstClass = f.fare;
          });
        }

        const farePairsList = Object.entries(faresMap);

        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Panel: Fare Setup Form (6 cols) */}
            <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span>Configure Coach Fares Matrix</span>
              </h3>

              <form onSubmit={handleCreateFares} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Select Train</label>
                  <select
                    value={fareTrainId}
                    onChange={(e) => {
                      setFareTrainId(e.target.value);
                      setFareFromStn('');
                      setFareToStn('');
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
                  >
                    <option value="">-- Choose Train --</option>
                    {trains.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (#{t.trainNumber}) {t.fares?.length ? `[${t.fares.length} Fares Configured]` : '[No Fares]'}
                      </option>
                    ))}
                  </select>
                </div>

                {fareTrainId && routeStops.length === 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>This train has no route stops configured. Showing all registered stations.</span>
                  </div>
                )}

                {(() => {
                  const fromStop = routeStops.find((st: any) => st.stationId === fareFromStn);
                  const validToStations = fareFromStn && routeStops.length > 0
                    ? trainRouteStations.filter((s: any) => {
                        if (s.id === fareFromStn) return false;
                        const toStop = routeStops.find((st: any) => st.stationId === s.id);
                        return !fromStop || !toStop || toStop.sequence > fromStop.sequence;
                      })
                    : trainRouteStations.filter((s: any) => s.id !== fareFromStn);

                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">From Station (Origin)</label>
                        <select
                          value={fareFromStn}
                          onChange={(e) => {
                            setFareFromStn(e.target.value);
                            setFareToStn('');
                          }}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                        >
                          <option value="">Select Origin Station</option>
                          {trainRouteStations.map((s: any) => {
                            const stop = routeStops.find((st: any) => st.stationId === s.id);
                            return (
                              <option key={s.id} value={s.id}>
                                {stop ? `#${stop.sequence} - ` : ''}{s.name} ({s.code})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">To Station (Destination)</label>
                        <select
                          value={fareToStn}
                          onChange={(e) => setFareToStn(e.target.value)}
                          disabled={!fareFromStn}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white disabled:opacity-50"
                        >
                          <option value="">
                            {!fareFromStn ? 'Select Origin First' : 'Select Destination Station'}
                          </option>
                          {validToStations.map((s: any) => {
                            const stop = routeStops.find((st: any) => st.stationId === s.id);
                            return (
                              <option key={s.id} value={s.id}>
                                {stop ? `#${stop.sequence} - ` : ''}{s.name} ({s.code})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const isDuplicatePair = selectedTrain?.fares?.some(
                    (f: any) => f.fromStationId === fareFromStn && f.toStationId === fareToStn
                  );
                  const isInvalid = !fareTrainId || !fareFromStn || !fareToStn || fareFromStn === fareToStn || fareGeneral < 0 || fareFirstClass < 0;

                  return (
                    <>
                      {fareFromStn && fareToStn && isDuplicatePair && (
                        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs flex items-center justify-between font-medium">
                          <span>Editing existing fare rule for selected stations.</span>
                          <span className="font-mono text-[10px] bg-purple-500/20 px-2 py-0.5 rounded font-bold">MODE: UPDATE</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">GENERAL Fare (₹)</label>
                          <input
                            type="number"
                            value={fareGeneral}
                            onChange={(e) => setFareGeneral(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">FIRST_CLASS Fare (₹)</label>
                          <input
                            type="number"
                            value={fareFirstClass}
                            onChange={(e) => setFareFirstClass(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="submit"
                          disabled={isInvalid}
                          className={`flex-1 py-3 font-bold rounded-xl text-xs transition-all ${
                            isInvalid
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                              : isDuplicatePair
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
                          }`}
                        >
                          {isInvalid
                            ? 'Fill All Required Fields'
                            : isDuplicatePair
                            ? 'Update Existing Fares'
                            : 'Save Coach Fares'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFareFromStn('');
                            setFareToStn('');
                            setFareGeneral(150);
                            setFareFirstClass(350);
                          }}
                          className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-all"
                        >
                          Clear
                        </button>
                      </div>
                    </>
                  );
                })()}
              </form>
            </div>

            {/* Right Panel: Live Fares Table for Selected Train (6 cols) */}
            <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                <span>
                  {selectedTrain ? `Fares Matrix: ${selectedTrain.name}` : 'Current Fares Matrix'}
                </span>
                {selectedTrain && (
                  <span className="text-xs text-emerald-400 font-mono font-bold">
                    #{selectedTrain.trainNumber}
                  </span>
                )}
              </h3>

              {!fareTrainId ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  <DollarSign className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p>Select a train on the left to view and edit its configured coach fares.</p>
                </div>
              ) : farePairsList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  <p>No fares configured for {selectedTrain?.name} yet.</p>
                  <p className="text-xs text-slate-500 mt-1">Select Origin & Destination stations to add new fares.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {farePairsList.map(([key, item]) => {
                    const [fromId, toId] = key.split('_');
                    return (
                      <div
                        key={key}
                        className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/80 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2 font-bold text-white mb-1">
                            <span className="font-mono text-emerald-400">{item.fromStn?.code || 'FROM'}</span>
                            <span className="text-slate-500">→</span>
                            <span className="font-mono text-blue-400">{item.toStn?.code || 'TO'}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({item.fromStn?.name || 'Origin'} - {item.toStn?.name || 'Dest'})
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="text-slate-300">
                              GENERAL: <strong className="text-emerald-400 font-mono">₹{item.general ?? 'N/A'}</strong>
                            </span>
                            <span className="text-slate-300">
                              FIRST_CLASS: <strong className="text-purple-300 font-mono">₹{item.firstClass ?? 'N/A'}</strong>
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setFareFromStn(fromId);
                            setFareToStn(toId);
                            if (item.general !== undefined) setFareGeneral(item.general);
                            if (item.firstClass !== undefined) setFareFirstClass(item.firstClass);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 text-xs font-semibold transition-all"
                        >
                          Edit Fare
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        );
      })()}

      {/* 5. Schedule Generator & Active Schedules */}
      {activeSubTab === 'schedules' && (() => {
        const selectedTrain = trains.find((t) => t.id === schedTrainId);
        const hasRoute = selectedTrain?.route?.stops && selectedTrain.route.stops.length > 0;
        const stops = selectedTrain?.route?.stops || [];
        const originStn = stops[0]?.station?.code || 'START';
        const destStn = stops[stops.length - 1]?.station?.code || 'END';

        // Collect FUTURE schedules ONLY for the selected train
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const displaySchedules: Array<{ trainName: string; trainNumber: string; schedule: any }> = [];
        if (schedTrainId && selectedTrain?.schedules && Array.isArray(selectedTrain.schedules)) {
          selectedTrain.schedules
            .filter((sch: any) => new Date(sch.departureDate) >= today)
            .forEach((sch: any) => {
              displaySchedules.push({
                trainName: selectedTrain.name,
                trainNumber: selectedTrain.trainNumber,
                schedule: sch,
              });
            });
        }

        // Sort by departure date ascending (nearest first)
        displaySchedules.sort((a, b) => new Date(a.schedule.departureDate).getTime() - new Date(b.schedule.departureDate).getTime());

        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Panel: Schedule Form (6 cols) */}
            <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                <span>Create Active Train Schedule</span>
              </h3>

              <form onSubmit={handleCreateSchedule} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Select Train</label>
                  <select
                    value={schedTrainId}
                    onChange={(e) => setSchedTrainId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
                  >
                    <option value="">-- Choose Train --</option>
                    {trains.map((t) => (
                      <option key={t.id} value={t.id}>
                      {t.name} (#{t.trainNumber}) {(() => {
                        const now = new Date(); now.setHours(0,0,0,0);
                        const future = (t.schedules || []).filter((s: any) => new Date(s.departureDate) >= now);
                        return future.length ? `[${future.length} Upcoming Schedules]` : '[No Upcoming Schedules]';
                      })()}
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const isAlreadyScheduled = selectedTrain?.schedules?.some((sch: any) => {
                    const existingDate = new Date(sch.departureDate).toISOString().split('T')[0];
                    return existingDate === schedDepartureDate;
                  });

                  return (
                    <>
                      {schedTrainId && isAlreadyScheduled && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2 font-medium">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>A schedule for this train on <strong>{schedDepartureDate}</strong> already exists. Multiple schedules on the same day are prohibited.</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Departure Date</label>
                        <input
                          type="date"
                          required
                          value={schedDepartureDate}
                          onChange={(e) => setSchedDepartureDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 font-semibold"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!schedTrainId || !hasRoute || Boolean(isAlreadyScheduled)}
                        className={`w-full py-3 font-bold rounded-xl text-xs transition-all ${
                          !schedTrainId || !hasRoute || isAlreadyScheduled
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
                        }`}
                      >
                        {!schedTrainId
                          ? 'Select a Train'
                          : !hasRoute
                          ? 'Configure Train Route First'
                          : isAlreadyScheduled
                          ? 'Schedule Already Exists for Date'
                          : 'Generate Active Schedule & Trigger Outbox'}
                      </button>
                    </>
                  );
                })()}
              </form>
            </div>

            {/* Right Panel: Active Schedules List (6 cols) */}
            <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                <span>
                  {selectedTrain ? `Active Schedules: ${selectedTrain.name}` : 'Active Train Schedules'}
                </span>
                {selectedTrain && (
                  <span className="text-xs text-purple-400 font-semibold">{displaySchedules.length} Active</span>
                )}
              </h3>

              {!schedTrainId ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p>Select a train on the left to view its active schedules.</p>
                </div>
              ) : displaySchedules.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p>No active schedules for {selectedTrain?.name}.</p>
                  <p className="text-xs text-slate-500 mt-1">Choose a date on the left to generate new schedules.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {displaySchedules.map(({ trainName, trainNumber, schedule }) => {
                    const departureDateFormatted = new Date(schedule.departureDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <div
                        key={schedule.id}
                        className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/80 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2 font-bold text-white mb-1">
                            <span>{trainName}</span>
                            <span className="font-mono text-purple-300">#{trainNumber}</span>
                          </div>
                          <p className="text-slate-400 font-mono text-[11px]">
                            Departure Date: <strong className="text-white">{departureDateFormatted}</strong>
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            ID: {schedule.id.slice(0, 18)}...
                          </p>
                        </div>

                        <div className="text-right flex flex-col items-end gap-1">
                          <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono font-bold text-[10px]">
                            {schedule.status || 'ACTIVE'}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            Outbox Synced
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        );
      })()}

    </div>
  );
};
