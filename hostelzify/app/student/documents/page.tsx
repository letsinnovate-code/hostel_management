'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  Trash2,
  Eye,
  Shield,
  RefreshCw,
  Plus,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { format } from 'date-fns';

const DOC_TYPES = [
  { value: 'aadhar', label: 'Aadhar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'college-id', label: 'College ID' },
  { value: 'address-proof', label: 'Address Proof' },
  { value: 'other', label: 'Other' },
];

export default function StudentDocumentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('aadhar');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    loadProfile();
  }, [user, router]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await api.getProfile();
      const profile = res?.data ?? res;
      const profileData = profile?.profile || profile;
      setDocuments(profileData?.documents || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
      toast.error('Could not load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('@hostel_app_token') || '';
      const studentId = user?.id || user?._id;

      if (!studentId || !token) {
        throw new Error('Authentication session expired');
      }

      await api.uploadSelfDocuments(
        studentId,
        [{ file: selectedFile, type: selectedType, name: selectedFile.name }],
        token
      );

      toast.success('Document uploaded successfully!');
      setUploadModalOpen(false);
      setSelectedFile(null);
      loadProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            My Identity & Documents
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Secure document vault for college verification, KYC, and hostel residency compliance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadProfile}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm transition-all shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      {/* Security Note Banner */}
      <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 space-y-0.5">
          <p className="font-semibold">Privacy & Encryption Protected</p>
          <p className="text-blue-700">
            Uploaded identity documents are encrypted and only accessible by the hostel owner and warden for residency verification.
          </p>
        </div>
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
          Loading your document vault...
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-14 h-14 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-gray-900 text-base">No documents uploaded yet</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            Please upload your Aadhar Card, College ID, and address proof for administrative verification.
          </p>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-all shadow-md shadow-blue-100"
          >
            Upload Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {documents.map((doc, idx) => {
            const typeLabel = DOC_TYPES.find((t) => t.value === doc.type)?.label || doc.type || 'Document';
            return (
              <div
                key={idx}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                      <FileCheck className="w-6 h-6" />
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                      <CheckCircle className="w-3 h-3" />
                      Uploaded
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900 text-base truncate">{doc.name || typeLabel}</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-0.5">{typeLabel}</p>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    {doc.uploadedAt ? format(new Date(doc.uploadedAt), 'dd MMM yyyy') : 'Recently'}
                  </span>
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View File
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-lg">Upload Identity Document</h3>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Document Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Select File (PDF, JPEG, PNG)
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  required
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Document
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
