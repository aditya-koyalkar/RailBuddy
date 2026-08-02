import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '../services/api';
import { Search, MapPin, Calendar, Train, ArrowRightLeft, ShieldCheck, Zap, Sparkles, Clock } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [journeyDate, setJourneyDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedClass, setSelectedClass] = useState('ALL');

  // Autocomplete state
  const [fromSuggestions, setFromSuggestions] = useState<any[]>([]);
  const [toSuggestions, setToSuggestions] = useState<any[]>([]);
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  // Debounced station autocomplete for From input
  useEffect(() => {
    if (fromInput.trim().length < 2) {
      setFromSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.autocomplete(fromInput);
        if (res.data) setFromSuggestions(res.data);
      } catch (err) {
        console.error('From station autocomplete error:', err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [fromInput]);

  // Debounced station autocomplete for To input
  useEffect(() => {
    if (toInput.trim().length < 2) {
      setToSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.autocomplete(toInput);
        if (res.data) setToSuggestions(res.data);
      } catch (err) {
        console.error('To station autocomplete error:', err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [toInput]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fromRef.current && !fromRef.current.contains(e.target as Node)) {
        setShowFromDropdown(false);
      }
      if (toRef.current && !toRef.current.contains(e.target as Node)) {
        setShowToDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwap = () => {
    const temp = fromInput;
    setFromInput(toInput);
    setToInput(temp);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromInput || !toInput) return;
    const fromCode = fromInput.includes('(') ? fromInput.split('(')[1].replace(')', '').trim() : fromInput.trim();
    const toCode = toInput.includes('(') ? toInput.split('(')[1].replace(')', '').trim() : toInput.trim();
    navigate(`/search?from=${encodeURIComponent(fromCode)}&to=${encodeURIComponent(toCode)}&date=${encodeURIComponent(journeyDate)}&class=${encodeURIComponent(selectedClass)}`);
  };

  const quickPopularRoutes = [
    { from: 'NDLS', fromName: 'New Delhi', to: 'BCT', toName: 'Mumbai Central' },
    { from: 'SBC', fromName: 'Bengaluru', to: 'MAS', toName: 'Chennai Central' },
    { from: 'HWH', fromName: 'Howrah Kolkata', to: 'NDLS', toName: 'New Delhi' },
    { from: 'HYB', fromName: 'Hyderabad', to: 'SBC', toName: 'Bengaluru' },
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* Hero Banner */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28 bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950">
        
        {/* Glow Blobs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-blue-600/20 to-indigo-600/20 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Next-Gen Distributed Train Booking Platform</span>
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
              Book Train Tickets with{' '}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                Real-Time Seat Locks
              </span>
            </h1>

            <p className="mt-4 text-base sm:text-lg text-slate-300">
              Instant searching across all railway routes, guaranteed seat reservation with Saga Orchestration, and zero latency.
            </p>
          </div>

          {/* Search Widget Card */}
          <div className="max-w-4xl mx-auto bg-slate-900/90 border border-slate-700/70 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                
                {/* From Station */}
                <div className="md:col-span-5 relative" ref={fromRef}>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    From Station
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-5 h-5 text-blue-400" />
                    <input
                      type="text"
                      required
                      value={fromInput}
                      onChange={(e) => {
                        setFromInput(e.target.value);
                        setShowFromDropdown(true);
                      }}
                      onFocus={() => setShowFromDropdown(true)}
                      placeholder="e.g. NDLS, New Delhi"
                      className="w-full pl-11 pr-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-medium placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {/* Autocomplete Dropdown */}
                  {showFromDropdown && fromSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto">
                      {fromSuggestions.map((st) => (
                        <div
                          key={st.id || st.code}
                          onClick={() => {
                            setFromInput(`${st.name} (${st.code})`);
                            setShowFromDropdown(false);
                          }}
                          className="p-3 hover:bg-slate-700/70 cursor-pointer border-b border-slate-700/50 last:border-0 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-white">{st.name}</p>
                            <p className="text-slate-400">{st.city}, {st.state}</p>
                          </div>
                          <span className="font-mono bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded">
                            {st.code}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Swap Button */}
                <div className="hidden md:flex md:col-span-2 justify-center pt-5">
                  <button
                    type="button"
                    onClick={handleSwap}
                    className="p-3 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all hover:scale-110 shadow-md"
                    title="Swap Origin and Destination"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                  </button>
                </div>

                {/* To Station */}
                <div className="md:col-span-5 relative" ref={toRef}>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    To Station
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-5 h-5 text-indigo-400" />
                    <input
                      type="text"
                      required
                      value={toInput}
                      onChange={(e) => {
                        setToInput(e.target.value);
                        setShowToDropdown(true);
                      }}
                      onFocus={() => setShowToDropdown(true)}
                      placeholder="e.g. BCT, Mumbai Central"
                      className="w-full pl-11 pr-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-medium placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                    />
                  </div>

                  {/* Autocomplete Dropdown */}
                  {showToDropdown && toSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto">
                      {toSuggestions.map((st) => (
                        <div
                          key={st.id || st.code}
                          onClick={() => {
                            setToInput(`${st.name} (${st.code})`);
                            setShowToDropdown(false);
                          }}
                          className="p-3 hover:bg-slate-700/70 cursor-pointer border-b border-slate-700/50 last:border-0 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-white">{st.name}</p>
                            <p className="text-slate-400">{st.city}, {st.state}</p>
                          </div>
                          <span className="font-mono bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded">
                            {st.code}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Journey Date & Class Filter */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center border-t border-slate-800 pt-5">
                
                <div className="sm:col-span-6">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Date of Journey
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                    <input
                      type="date"
                      required
                      value={journeyDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setJourneyDate(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Coach Class Preference
                  </label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500 text-sm"
                  >
                    <option value="ALL">All Classes (1A, 2A, 3A, SL)</option>
                    <option value="1A">AC First Class (1A)</option>
                    <option value="2A">AC 2 Tier (2A)</option>
                    <option value="3A">AC 3 Tier (3A)</option>
                    <option value="SL">Sleeper (SL)</option>
                  </select>
                </div>

              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-base rounded-xl shadow-xl shadow-blue-600/25 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3"
              >
                <Search className="w-5 h-5" />
                <span>Search Available Trains</span>
              </button>

            </form>
          </div>

          {/* Quick Popular Routes */}
          <div className="mt-8 text-center">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Popular Routes</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {quickPopularRoutes.map((r, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setFromInput(`${r.fromName} (${r.from})`);
                    setToInput(`${r.toName} (${r.to})`);
                    navigate(`/search?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}&date=${encodeURIComponent(journeyDate)}&class=${encodeURIComponent(selectedClass)}`);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 hover:border-blue-500/50 text-slate-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5"
                >
                  <Train className="w-3.5 h-3.5 text-blue-400" />
                  <span>{r.from} → {r.to}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-16 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Distributed Seat Locking</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Prevents double booking during high concurrency using Redis distributed locks and Postgres segment availability.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Saga Orchestration Engine</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Automated multi-step saga workflow with outbox pattern for fault-tolerant payments, inventory release, and PNR creation.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">API Gateway Architecture</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                All client requests route through secure API Gateway with circuit breakers, rate limiting, and centralized JWT authentication.
              </p>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
};
