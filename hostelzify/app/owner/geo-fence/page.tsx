'use client';

import { useState, useEffect } from 'react';
import GeoFenceMap, { LatLng, getDefaultPolygonAroundHostel } from '../../../components/GeoFenceMap';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import { useToast } from '../../../components/Toast';

type Hostel = { _id: string; name: string; address?: { coordinates?: { latitude?: number; longitude?: number } } };
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
  const { selectedHostel: selectedHostelId } = useOwnerHostel();
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

  const loadHostelAndGeoFences = async () => {
    if (!selectedHostelId) return;
    setLoading(true);
    try {
      const [hostelRes, fenceRes] = await Promise.all([
        api.getHostel(selectedHostelId),
        api.getGeoFences(selectedHostelId),
      ]);
      const hostel = hostelRes?.data ?? hostelRes;
      const fences = fenceRes?.data ?? fenceRes ?? [];
      setSelectedHostel(hostel);
      setGeoFences(Array.isArray(fences) ? fences : []);
      const polyFence = (Array.isArray(fences) ? fences : []).find(
        (f: GeoFence) => f.type === 'polygon' && f.polygon && f.polygon.length >= 3
      );
      if (polyFence?.polygon) {
        setPolygon(polyFence.polygon);
      } else {
        const lat = hostel?.address?.coordinates?.latitude ?? 28.6139;
        const lng = hostel?.address?.coordinates?.longitude ?? 77.209;
        setPolygon(getDefaultPolygonAroundHostel(lat, lng, 50));
      }
    } catch (e: any) {
      showToast(e?.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const hostelCoords = selectedHostel?.address?.coordinates;
  const baseLat = hostelCoords?.latitude ?? 28.6139;
  const baseLng = hostelCoords?.longitude ?? 77.209;
  const centroid = polygon && polygon.length >= 3 ? getPolygonCentroid(polygon) : null;
  const hostelLat = centroid?.latitude ?? baseLat;
  const hostelLng = centroid?.longitude ?? baseLng;

  const handleResetArea = () => {
    setPolygon(getDefaultPolygonAroundHostel(hostelLat, hostelLng, 50));
  };

  const handleSaveBoundary = async () => {
    if (!selectedHostelId || !selectedHostel?.name) {
      showToast('Select a hostel first.', 'error');
      return;
    }
    if (!polygon || polygon.length < 3) {
      showToast('Resize the box on the map, then save.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.createGeoFence({
        hostelId: selectedHostelId,
        name: `${selectedHostel.name} boundary`,
        type: 'polygon',
        polygon,
        isActive: true,
      });
      showToast('Hostel boundary saved. Students inside this area will be marked as inside the hostel.', 'success');
      loadHostelAndGeoFences();
    } catch (e: any) {
      showToast(e?.response?.data?.message || e?.message || 'Failed to save boundary', 'error');
    } finally {
      setSaving(false);
    }
  };

  const canSave = polygon && polygon.length >= 3;

  return (
    <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Geo-Fence Setup</h1>
        <p className="text-gray-600 mb-6">
          Resize the box on the map to match your hostel boundary, then click Save. Students inside the area are marked as inside the hostel.
        </p>

        {selectedHostelId && (
          <>
            {selectedHostel?.address?.coordinates?.latitude == null ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
                This hostel has no address coordinates. Set the hostel address (with location) on the hostel edit page first.
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-4 mb-4">
                <GeoFenceMap
                  hostelLat={hostelLat}
                  hostelLng={hostelLng}
                  polygon={polygon}
                  editable={true}
                  onPolygonChange={setPolygon}
                  height="450px"
                  zoom={17}
                />

                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={handleResetArea}
                    className="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Reset to default box (50 m)
                  </button>
                  {canSave && (
                    <button
                      type="button"
                      onClick={handleSaveBoundary}
                      disabled={saving}
                      className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save boundary'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {loading && selectedHostelId && <p className="text-gray-500 mt-2">Loading...</p>}
      </div>
  );
}
