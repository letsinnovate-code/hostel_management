'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';

interface Rule {
  _id?: string;
  hostelId: string;
  hostelName?: string;
  curfewTime: string;
  weekendCurfewTime: string;
  lateEntryAllowed: boolean;
  lateEntryFine: number;
  visitorAllowed: boolean;
  visitorTimings: string;
  messTimings: {
    breakfast: string;
    lunch: string;
    dinner: string;
  };
  smokingAllowed: boolean;
  alcoholAllowed: boolean;
  petsAllowed: boolean;
  oppositeGenderAllowed: boolean;
  customRules?: string[];
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export default function OwnerRulesPage() {
  const { user } = useAuth();
  const { hostels, selectedHostel } = useOwnerHostel();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<Rule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [customRuleInput, setCustomRuleInput] = useState('');

  const [formData, setFormData] = useState<Rule>({
    hostelId: '',
    curfewTime: '',
    weekendCurfewTime: '',
    lateEntryAllowed: false,
    lateEntryFine: 0,
    visitorAllowed: true,
    visitorTimings: '',
    messTimings: {
      breakfast: '',
      lunch: '',
      dinner: '',
    },
    smokingAllowed: false,
    alcoholAllowed: false,
    petsAllowed: false,
    oppositeGenderAllowed: false,
    customRules: [],
    status: 'active',
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await api.getRules();
      const rulesData = response.data || [];

      // Enrich rules with hostel names
      const enrichedRules = rulesData.map((rule: any) => ({
        ...rule,
        hostelName: rule.hostelId?.name || rule.hostelName || 'Unknown Hostel',
        hostelId: typeof rule.hostelId === 'object' ? rule.hostelId._id : rule.hostelId,
      }));

      setRules(enrichedRules);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
      toast.error('Failed to fetch rules. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.hostelId) {
      toast.error('Please select a hostel');
      return;
    }

    setLoading(true);
    try {
      if (editingRule?._id) {
        await api.updateRule(editingRule._id, formData);
        toast.success('Rules updated successfully');
      } else {
        await api.createRule(formData);
        toast.success('Rules created successfully');
      }

      setShowForm(false);
      setEditingRule(null);
      resetForm();
      fetchRules();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to save rules');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setFormData(rule);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete these rules?')) return;

    setLoading(true);
    try {
      await api.deleteRule(id);
      toast.success('Rules deleted successfully');
      fetchRules();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to delete rules');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    const defaultHostelId = selectedHostel || (hostels.length > 0 ? (hostels[0]._id || hostels[0].id) : '') || '';
    setFormData({
      hostelId: defaultHostelId,
      curfewTime: '',
      weekendCurfewTime: '',
      lateEntryAllowed: false,
      lateEntryFine: 0,
      visitorAllowed: true,
      visitorTimings: '',
      messTimings: {
        breakfast: '',
        lunch: '',
        dinner: '',
      },
      smokingAllowed: false,
      alcoholAllowed: false,
      petsAllowed: false,
      oppositeGenderAllowed: false,
      customRules: [],
      status: 'active',
    });
  };

  const addCustomRule = () => {
    if (customRuleInput.trim()) {
      setFormData({
        ...formData,
        customRules: [...(formData.customRules || []), customRuleInput.trim()],
      });
      setCustomRuleInput('');
    }
  };

  const removeCustomRule = (index: number) => {
    setFormData({
      ...formData,
      customRules: (formData.customRules || []).filter((_, i) => i !== index),
    });
  };

  const filteredRules = selectedHostel
    ? rules.filter(rule => rule.hostelId === selectedHostel)
    : rules;

  return (
    <>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Hostel Rules & Policies</h1>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingRule(null);
              resetForm();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + Add New Rules
          </button>
        </div>

        {/* Rules Form */}
        {showForm && (
          <div className="mb-6 bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingRule ? 'Edit Rules' : 'Add New Rules'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Hostel Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hostel *
                </label>
                <select
                  value={formData.hostelId}
                  onChange={(e) => setFormData({ ...formData, hostelId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={!!editingRule}
                >
                  {hostels.map((hostel) => (
                    <option key={hostel._id || hostel.id} value={hostel._id || hostel.id}>
                      {hostel.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Curfew Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Curfew Time
                  </label>
                  <input
                    type="time"
                    value={formData.curfewTime}
                    onChange={(e) => setFormData({ ...formData, curfewTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weekend Curfew Time
                  </label>
                  <input
                    type="time"
                    value={formData.weekendCurfewTime}
                    onChange={(e) => setFormData({ ...formData, weekendCurfewTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Late Entry */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="lateEntryAllowed"
                    checked={formData.lateEntryAllowed}
                    onChange={(e) => setFormData({ ...formData, lateEntryAllowed: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="lateEntryAllowed" className="text-sm font-medium text-gray-700">
                    Late Entry Allowed
                  </label>
                </div>
                {formData.lateEntryAllowed && (
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Late Entry Fine (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.lateEntryFine}
                      onChange={(e) => setFormData({ ...formData, lateEntryFine: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Visitors */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="visitorAllowed"
                    checked={formData.visitorAllowed}
                    onChange={(e) => setFormData({ ...formData, visitorAllowed: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="visitorAllowed" className="text-sm font-medium text-gray-700">
                    Visitors Allowed
                  </label>
                </div>
                {formData.visitorAllowed && (
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visitor Timings
                    </label>
                    <input
                      type="text"
                      value={formData.visitorTimings}
                      onChange={(e) => setFormData({ ...formData, visitorTimings: e.target.value })}
                      placeholder="e.g., 10:00 AM - 8:00 PM"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Mess Timings */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Mess Timings</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Breakfast
                    </label>
                    <input
                      type="text"
                      value={formData.messTimings.breakfast}
                      onChange={(e) => setFormData({
                        ...formData,
                        messTimings: { ...formData.messTimings, breakfast: e.target.value }
                      })}
                      placeholder="e.g., 7:00 AM - 9:00 AM"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lunch</label>
                    <input
                      type="text"
                      value={formData.messTimings.lunch}
                      onChange={(e) => setFormData({
                        ...formData,
                        messTimings: { ...formData.messTimings, lunch: e.target.value }
                      })}
                      placeholder="e.g., 12:00 PM - 2:00 PM"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dinner</label>
                    <input
                      type="text"
                      value={formData.messTimings.dinner}
                      onChange={(e) => setFormData({
                        ...formData,
                        messTimings: { ...formData.messTimings, dinner: e.target.value }
                      })}
                      placeholder="e.g., 7:00 PM - 9:00 PM"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Other Rules */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Other Rules</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'smokingAllowed', label: 'Smoking Allowed' },
                    { id: 'alcoholAllowed', label: 'Alcohol Allowed' },
                    { id: 'petsAllowed', label: 'Pets Allowed' },
                    { id: 'oppositeGenderAllowed', label: 'Opposite Gender Allowed' },
                  ].map((rule) => (
                    <div key={rule.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={rule.id}
                        checked={formData[rule.id as keyof Rule] as boolean}
                        onChange={(e) => setFormData({ ...formData, [rule.id]: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={rule.id} className="text-sm font-medium text-gray-700">
                        {rule.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Rules */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Rules
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={customRuleInput}
                    onChange={(e) => setCustomRuleInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomRule())}
                    placeholder="Add custom rule"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addCustomRule}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {(formData.customRules || []).map((rule, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <span className="text-sm text-gray-700">{rule}</span>
                      <button
                        type="button"
                        onClick={() => removeCustomRule(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingRule(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : editingRule ? 'Update Rules' : 'Create Rules'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rules List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Existing Rules</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {loading && !showForm ? (
              <div className="p-6 text-center text-gray-500">Loading...</div>
            ) : filteredRules.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No rules found. Click "Add New Rules" to create one.
              </div>
            ) : (
              filteredRules.map((rule) => (
                <div key={rule._id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {rule.hostelName || 'Hostel'}
                      </h3>
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded-full ${rule.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                          }`}
                      >
                        {rule.status}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => rule._id && handleDelete(rule._id)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {rule.curfewTime && (
                      <div>
                        <span className="font-medium text-gray-700">Curfew Time:</span>{' '}
                        <span className="text-gray-600">{rule.curfewTime}</span>
                      </div>
                    )}
                    {rule.weekendCurfewTime && (
                      <div>
                        <span className="font-medium text-gray-700">Weekend Curfew:</span>{' '}
                        <span className="text-gray-600">{rule.weekendCurfewTime}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-gray-700">Late Entry:</span>{' '}
                      <span className="text-gray-600">
                        {rule.lateEntryAllowed ? `Allowed (₹${rule.lateEntryFine} fine)` : 'Not Allowed'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Visitors:</span>{' '}
                      <span className="text-gray-600">
                        {rule.visitorAllowed ? rule.visitorTimings || 'Allowed' : 'Not Allowed'}
                      </span>
                    </div>
                  </div>

                  {(rule.messTimings.breakfast || rule.messTimings.lunch || rule.messTimings.dinner) && (
                    <div className="mt-4">
                      <h4 className="font-medium text-gray-700 mb-2">Mess Timings:</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                        {rule.messTimings.breakfast && (
                          <div>Breakfast: {rule.messTimings.breakfast}</div>
                        )}
                        {rule.messTimings.lunch && <div>Lunch: {rule.messTimings.lunch}</div>}
                        {rule.messTimings.dinner && <div>Dinner: {rule.messTimings.dinner}</div>}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {rule.smokingAllowed && (
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                        Smoking Allowed
                      </span>
                    )}
                    {rule.alcoholAllowed && (
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                        Alcohol Allowed
                      </span>
                    )}
                    {rule.petsAllowed && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                        Pets Allowed
                      </span>
                    )}
                    {rule.oppositeGenderAllowed && (
                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                        Opposite Gender Allowed
                      </span>
                    )}
                  </div>

                  {rule.customRules && rule.customRules.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-gray-700 mb-2">Custom Rules:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                        {rule.customRules.map((customRule, index) => (
                          <li key={index}>{customRule}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
