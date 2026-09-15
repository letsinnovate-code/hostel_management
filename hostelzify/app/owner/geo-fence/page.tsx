'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { LatLng, getDefaultPolygonAroundHostel } from '../../../components/maps/mapTypes';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import { useToast } from '../../../components/Toast';
import { ShieldCheck, MapPin, Maximize2, RotateCcw, Save, Loader2, Sparkles } from 'lucide-react';

const OSMGeoFenceMap = dynamic(() => import('../../../components/maps/OSMGeoFenceMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] bg-gray-100 rounded-2xl flex items-center justify-center text-xs text-gray-500">
      Loading OpenStreetMap Interactive Geo-Fence Editor...
    </div>
  ),
});

type Hostel = {
  _id: string;
  name: string;
  address?: { coordinates?: { latitude?: number; longitude?: number } };
  location?: { coordinates?: [number, number] };
  latitude?: number;
  longitude?: number;
};
type LatLngPoint = { latitude: number; longitude: number };

function getPolygonCentroid(points: LatLngPoint[]): LatLngPoint | null {
  if (!points?.length) return null;
  const sumLat = points.reduce((s, p) => s + p.latitude, 0);
  const sumLng = points.reduce((s, p) => s + p.longitude, 0);
  return { latitude: sumLat / points.length, longitude: sumLng / points.length };
}

type GeoFence = {
  _id: string;
  name: string;
  type: 'circle' | 'rectangle' | 'polygon';
  polygon?: LatLng[];
  isActive?: boolean;
};

export default function OwnerGeoFencePage() {
  const { selectedHostel: selectedHostelId, activeHostel: contextHostel } = useOwnerHostel();
  const [selectedHostel, setSelectedHostel] = useState<Hostel | null>(null);
  const [geoFences, setGeoFences] = useState<GeoFence[]>([]);
  const [polygon, setPolygon] = useState<LatLng[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    if (selectedHostelId) {
      loadHostelAndGeoFences();
    } else {
      setSelectedHostel(null);
      setGeoFences([]);
      setPolygon(null);
      setLoading(false);
    }
  }, [selectedHostelId]);

  const extractHostelCoordinates = (h: any) => {
    const lat =
      h?.address?.coordinates?.latitude ??
      h?.location?.coordinates?.[1] ??
      h?.latitude ??
      (contextHostel as any)?.location?.coordinates?.[1] ??
      23.5235;
    const lng =
      h?.address?.coordinates?.longitude ??
      h?.location?.coordinates?.[0] ??
      h?.longitude ??
      (contextHostel as any)?.location?.coordinates?.[0] ??
      77.8139;
    return { lat: Number(lat), lng: Number(lng) };
  };

  const loadHostelAndGeoFences = async () => {
    if (!selectedHostelId) return;
    setLoading(true);
    try {
      const [hostelRes, fenceRes] = await Promise.all([
        api.getHostel(selectedHostelId).catch(() => contextHostel),
        api.getGeoFences(selectedHostelId).catch(() => []),
      ]);
      const hostel = hostelRes?.data ?? hostelRes ?? contextHostel;
      const fences = fenceRes?.data ?? fenceRes ?? [];
      setSelectedHostel(hostel);
      setGeoFences(Array.isArray(fences) ? fences : []);

      const polyFence = (Array.isArray(fences) ? fences : []).find(
        (f: GeoFence) => f.type === 'polygon' && f.polygon && f.polygon.length >= 3
      );

      const { lat, lng } = extractHostelCoordinates(hostel);

      if (polyFence?.polygon) {
        setPolygon(polyFence.polygon);
      } else {
        setPolygon(getDefaultPolygonAroundHostel(lat, lng, 60));
      }
    } catch (e: any) {
      showToast(e?.message || 'Failed to load geofence setup', 'error');
    } finally {
      setLoading(false);
    }
  };

  const { lat: baseLat, lng: baseLng } = extractHostelCoordinates(selectedHostel);
  const centroid = polygon && polygon.length >= 3 ? getPolygonCentroid(polygon) : null;
  const hostelLat = centroid?.latitude ?? baseLat;
  const hostelLng = centroid?.longitude ?? baseLng;

  const handleApplyPreset = (radiusMeters: number) => {
    setPolygon(getDefaultPolygonAroundHostel(hostelLat, hostelLng, radiusMeters));
    showToast(`Applied ${radiusMeters}m boundary preset`, 'info');
  };

  const handleSaveBoundary = async () => {
    if (!selectedHostelId) {
      showToast('Select a hostel first.', 'error');
      return;
    }
    if (!polygon || polygon.length < 3) {
      showToast('Define at least 3 vertices on the map before saving.', 'error');
      return;
    }
    setSaving(true);
    try {
      const hostelName = selectedHostel?.name || 'Hostel';
      await api.createGeoFence({
        hostelId: selectedHostelId,
        name: `${hostelName} Geo-Fence Boundary`,
        type: 'polygon',
        polygon,
        isActive: true,
      });
      showToast('Hostel geo-fence boundary saved successfully on OpenStreetMap!', 'success');
      loadHostelAndGeoFences();
    } catch (e: any) {
      showToast(e?.response?.data?.message || e?.message || 'Failed to save boundary', 'error');
    } finally {
      setSaving(false);
    }
  };

  const canSave = polygon && polygon.length >= 3;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Perimeter Security & Automated Attendance
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mt-1">
            Hostel Geo-Fence Boundary
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Drag corner vertices on OpenStreetMap to define your physical property polygon. Students inside the perimeter are dynamically verified.
          </p>
        </div>

        {canSave && (
          <button
            onClick={handleSaveBoundary}
            disabled={saving || loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Boundary
          </button>
        )}
      </div>

      {!selectedHostelId ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center shadow-xs">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900">No Hostel Selected</h3>
          <p className="text-xs text-gray-500 mt-1">
            Please choose a hostel property from the global top selector to configure its geo-fence.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Shape Presets:
              </span>
              <button
                type="button"
                onClick={() => handleApplyPreset(40)}
                className="px-2.5 py-1 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                40m Compact
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(75)}
                className="px-2.5 py-1 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                75m Standard
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(120)}
                className="px-2.5 py-1 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                120m Campus
              </button>
            </div>

            <div className="text-xs font-semibold text-gray-500 flex items-center gap-2">
              <span>Center: {hostelLat.toFixed(5)}, {hostelLng.toFixed(5)}</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                {polygon?.length || 0} Vertices
              </span>
            </div>
          </div>

          {/* Interactive Map */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
            <OSMGeoFenceMap
              hostelLat={hostelLat}
              hostelLng={hostelLng}
              hostelName={selectedHostel?.name || 'Hostel'}
              polygon={polygon}
              editable={true}
              onPolygonChange={setPolygon}
              height="520px"
              zoom={17}
            />
          </div>
        </div>
      )}
    </div>
  );
}
