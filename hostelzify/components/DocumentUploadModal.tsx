'use client';

import { useState } from 'react';
import { FileText, CreditCard, GraduationCap, MapPin, File, X, ChevronDown, Upload, Check } from 'lucide-react';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (file: File, type: string, name: string) => void;
}

const DOCUMENT_TYPES = [
  { value: 'aadhar', label: 'Aadhar Card', icon: FileText },
  { value: 'pan', label: 'PAN Card', icon: CreditCard },
  { value: 'college-id', label: 'College ID', icon: GraduationCap },
  { value: 'address-proof', label: 'Address Proof', icon: MapPin },
  { value: 'other', label: 'Other', icon: File },
];

export default function DocumentUploadModal({ isOpen, onClose, onAdd }: DocumentUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('aadhar');
  const [documentName, setDocumentName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!documentName) {
        setDocumentName(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      setFile(selectedFile);
      if (!documentName) {
        setDocumentName(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = () => {
    if (file && documentName) {
      onAdd(file, documentType, documentName);
      setFile(null);
      setDocumentType('aadhar');
      setDocumentName('');
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const selectedType = DOCUMENT_TYPES.find((type) => type.value === documentType);
  const SelectedIcon = selectedType?.icon || File;

  return (
    <div
      className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full transform transition-all">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <File className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Upload Document</h3>
                <p className="text-xs text-gray-500">Add a new document to the student's profile</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-5">
            {/* Document Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Document Type <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none bg-white cursor-pointer hover:border-gray-400"
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </div>
              </div>
              {selectedType && (
                <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1.5">
                  <SelectedIcon className="w-3.5 h-3.5" />
                  Selected: {selectedType.label}
                </p>
              )}
            </div>

            {/* Document Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Document Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Enter document name"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-gray-400 hover:border-gray-400"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select File <span className="text-red-500">*</span>
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`mt-1 flex justify-center px-6 pt-8 pb-8 border-2 border-dashed rounded-lg transition-all cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : file
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                <div className="space-y-3 text-center w-full">
                  {file ? (
                    <>
                      <div className="flex justify-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                          <Check className="w-8 h-8 text-green-600" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <label className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Change File
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleFileChange}
                          className="sr-only"
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex flex-col items-center gap-2">
                        <label className="relative cursor-pointer">
                          <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm inline-flex items-center gap-2">
                            <Upload className="w-5 h-5" />
                            Upload a file
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={handleFileChange}
                              className="sr-only"
                            />
                          </span>
                        </label>
                        <p className="text-sm text-gray-500">or drag and drop</p>
                        <p className="text-xs text-gray-400">PNG, JPG, PDF up to 10MB</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-5 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!file || !documentName}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
            >
              <Check className="w-5 h-5" />
              Add Document
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
