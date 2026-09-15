'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import { 
  ChevronLeft, 
  MapPin, 
  User, 
  RefreshCw, 
  Search, 
  ShieldCheck, 
  Navigation, 
  ExternalLink, 
  Filter, 
  Radio, 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  X,
  Smartphone
} from 'lucide-react';
import { StudentMarkerData } from '../../../components/maps/OSMStudentsMap';

const OSMStudentsMap = dynamic(() => import('../../../components/maps/OSMStudentsMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[450px] bg-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-500">
      Loading OpenStreetMap Interactive Student Tracker...
    </div>
  ),
});

export default function StudentsMapPage() {
  const { user } = useAuth();
  const { selectedHostel, activeHostel } = useOwnerHostel();
  const router = useRouter();

  const [students, setStudents] = useState<StudentMarkerData[]>([]);
  const [boundaryPolygon, setBoundaryPolygon] = useState<any[] | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'inside' | 'outside'>('all');
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [showSimModal, setShowSimModal] = useState(false);
  const [modalStudentId, setModalStudentId] = useState('');
  const [modalInside, setModalInside] = useState(true);

  useEffect(() => {
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  // Robust coordinate extraction — tries both storage formats
  const hostelLat: number =
    (activeHostel as any)?.address?.coordinates?.latitude ??
    (activeHostel as any)?.location?.coordinates?.[1] ??
    (activeHostel as any)?.latitude ??
    23.5235;
  const hostelLng: number =
    (activeHostel as any)?.address?.coordinates?.longitude ??
    (activeHostel as any)?.location?.coordinates?.[0] ??
    (activeHostel as any)?.longitude ??
    77.8139;
  const hostelName = activeHostel?.name || 'Hostel Campus';

  const loadData = async () => {
    if (!selectedHostel) {
      setStudents([]);
      setBoundaryPolygon(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [studentsData, fenceRes] = await Promise.all([
        api.getStudentLocations({ hostelId: selectedHostel }).catch(() => []),
        api.getGeoFences(selectedHostel).catch(() => []),
      ]);

      const rawStudents = Array.isArray(studentsData) ? studentsData : [];
      const fences = Array.isArray(fenceRes?.data) ? fenceRes.data : Array.isArray(fenceRes) ? fenceRes : [];
      const polyFence = fences.find((f: any) => f.type === 'polygon' && f.polygon && f.polygon.length >= 3);

      if (polyFence?.polygon) {
        setBoundaryPolygon(polyFence.polygon);
      } else {
        setBoundaryPolygon(null);
      }

      // Format student markers with fallback GPS near hostel if not set
      const formatted: StudentMarkerData[] = rawStudents.map((s: any, idx: number) => {
        let lat = s.currentLocation?.latitude;
        let lng = s.currentLocation?.longitude;

        // If no GPS yet, disperse them naturally around the hostel center
        if (!lat || !lng) {
          const angle = (idx * 45 * Math.PI) / 180;
          const dist = 0.0003 + (idx % 3) * 0.0002;
          lat = hostelLat + dist * Math.cos(angle);
          lng = hostelLng + dist * Math.sin(angle);
        }

        const isInside = s.isInside !== undefined ? s.isInside : true;

        return {
          _id: s._id || s.id,
          name: s.name || 'Student',
          email: s.email,
          phone: s.phone || s.phoneNumber,
          studentId: s.studentId,
          room: s.roomNumber || s.room?.roomNumber,
          currentLocation: {
            latitude: Number(lat),
            longitude: Number(lng),
            timestamp: s.currentLocation?.timestamp || new Date().toISOString(),
          },
          lastLocationUpdate: s.lastLocationUpdate || s.updatedAt || new Date().toISOString(),
          status: isInside ? 'Inside Property' : 'Outside Boundary',
          isInside,
        };
      });

      setStudents(formatted);
    } catch (e) {
      console.error('Failed to load students map data', e);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateLocation = async (studentId: string, inside: boolean) => {
    if (!studentId || !selectedHostel) return;
    setSimulating(true);
    setSimMessage(null);
    try {
      // If inside, put coordinate within ~20m of hostel
      // If outside, put coordinate ~1.2km away to breach geofence
      const offsetLat = inside ? (Math.random() * 0.0003 - 0.00015) : 0.012 + (Math.random() * 0.003);
      const offsetLng = inside ? (Math.random() * 0.0003 - 0.00015) : 0.012 + (Math.random() * 0.003);
      const targetLat = hostelLat + offsetLat;
      const targetLng = hostelLng + offsetLng;

      const res = await api.simulateStudentTelemetry({
        studentId,
        latitude: targetLat,
        longitude: targetLng,
        isInside: inside,
        accuracy: 8,
      });

      setSimMessage(res?.message || `Simulated GPS: ${inside ? 'Inside Campus' : 'Outside Geofence'}`);
      setSelectedStudentId(studentId);
      await loadData();
    } catch (err: any) {
      console.error('Simulation error:', err);
      setSimMessage(err?.response?.data?.message || 'Failed to simulate telemetry');
    } finally {
      setSimulating(false);
      setTimeout(() => setSimMessage(null), 5000);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedHostel]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (filterMode === 'inside' && !s.isInside) return false;
      if (filterMode === 'outside' && s.isInside) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const nameMatch = s.name.toLowerCase().includes(q);
        const emailMatch = s.email?.toLowerCase().includes(q);
        const roomMatch = s.room?.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !roomMatch) return false;
      }
      return true;
    });
  }, [students, filterMode, search]);

  const insideCount = useMemo(() => students.filter((s) => s.isInside).length, [students]);
  const outsideCount = useMemo(() => students.filter((s) => !s.isInside).length, [students]);
  const selectedStudent = useMemo(() => students.find((s) => s._id === selectedStudentId), [students, selectedStudentId]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Simulation Feedback Banner */}
      {simMessage && (
        <div className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-semibold flex items-center justify-between shadow-md transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{simMessage}</span>
          </div>
          <button onClick={() => setSimMessage(null)} className="p-1 hover:bg-emerald-700 rounded text-white/80 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/owner/dashboard"
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                Live OpenStreetMap Radar
              </span>
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">Student Campus Map</h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (students.length > 0) {
                setModalStudentId(selectedStudentId || students[0]._id);
              }
              setShowSimModal(true);
            }}
            disabled={students.length === 0}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center gap-1.5 text-xs font-bold transition-colors shadow-xs"
          >
            <Radio className="w-3.5 h-3.5" />
            Simulate GPS Ping
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading || !selectedHostel}
            className="px-3 py-1.5 rounded-xl border border-gray-300 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold text-gray-700 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Map
          </button>
        </div>
      </header>

      {!selectedHostel ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">Select a Hostel Property</h3>
            <p className="text-xs text-gray-500 mt-1">Pick a hostel from the top bar to inspect resident locations.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Main Map View */}
          <div className="flex-1 min-h-[450px] lg:min-h-0 p-4">
            <div className="h-full w-full rounded-2xl border border-gray-200 overflow-hidden shadow-xs relative">
              <OSMStudentsMap
                hostelLat={hostelLat}
                hostelLng={hostelLng}
                hostelName={hostelName}
                polygon={boundaryPolygon}
                students={students}
                selectedStudentId={selectedStudentId}
                onStudentSelect={(s) => setSelectedStudentId(s._id)}
                height="100%"
              />
            </div>
          </div>

          {/* Resident Sidebar */}
          <aside className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col overflow-hidden">
            {/* Filter and Stats Bar */}
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-emerald-600" />
                  Resident Roster ({students.length})
                </span>
                <div className="flex items-center gap-1 text-[11px] font-bold">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                    {insideCount} Inside
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700">
                    {outsideCount} Away
                  </span>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, room..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    filterMode === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  All ({students.length})
                </button>
                <button
                  onClick={() => setFilterMode('inside')}
                  className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    filterMode === 'inside' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  Inside ({insideCount})
                </button>
                <button
                  onClick={() => setFilterMode('outside')}
                  className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    filterMode === 'outside' ? 'bg-white text-rose-700 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  Outside ({outsideCount})
                </button>
              </div>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No residents match your filter criteria.
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const isSelected = selectedStudentId === s._id;
                  return (
                    <div
                      key={s._id}
                      onClick={() => setSelectedStudentId(s._id)}
                      className={`p-3.5 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected ? 'bg-emerald-50/70 border-l-4 border-emerald-500' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-gray-900 truncate">{s.name}</p>
                          {s.room && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                              Rm {s.room}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                          {s.email || s.studentId || 'No email'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            s.isInside
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {s.isInside ? 'Inside' : 'Outside'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Student Telemetry Action Panel */}
            {selectedStudent && (
              <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{selectedStudent.name}</h4>
                    <p className="text-[10px] text-gray-500">
                      ID: {selectedStudent.studentId || 'N/A'} {selectedStudent.room ? `• Rm ${selectedStudent.room}` : ''}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      selectedStudent.isInside ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {selectedStudent.isInside ? 'Inside Campus' : 'Outside Boundary'}
                  </span>
                </div>

                <div className="text-[10px] text-gray-500 bg-white p-2 rounded-lg border border-gray-200 flex items-center justify-between">
                  <span>GPS Lat/Lng:</span>
                  <span className="font-mono text-gray-700 font-semibold">
                    {selectedStudent.currentLocation?.latitude.toFixed(4)}, {selectedStudent.currentLocation?.longitude.toFixed(4)}
                  </span>
                </div>

                {/* Simulation Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={simulating}
                    onClick={() => handleSimulateLocation(selectedStudent._id, true)}
                    className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Simulate Inside
                  </button>
                  <button
                    type="button"
                    disabled={simulating}
                    onClick={() => handleSimulateLocation(selectedStudent._id, false)}
                    className="py-1.5 px-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors shadow-xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Simulate Breach
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Quick GPS Simulation Modal */}
      {showSimModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-900 font-bold">
                <Radio className="w-5 h-5 text-indigo-600" />
                <h3>Simulate Resident GPS Telemetry</h3>
              </div>
              <button
                onClick={() => setShowSimModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Trigger instant location telemetry for any resident to verify boundary breach alerts, curfew automation, and attendance logs.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Select Student</label>
                <select
                  value={modalStudentId}
                  onChange={(e) => setModalStudentId(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.room ? `Room ${s.room}` : s.email || s.studentId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Telemetry Location State</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalInside(true)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      modalInside
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Inside Campus (~15m)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalInside(false)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      !modalInside
                        ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Outside Boundary (~1.5km)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={simulating || !modalStudentId}
                onClick={async () => {
                  await handleSimulateLocation(modalStudentId, modalInside);
                  setShowSimModal(false);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
              >
                {simulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Telemetry Ping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
