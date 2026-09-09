'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { useToast } from '../../../components/Toast';
import { useConfirmModal } from '../../../components/ConfirmModal';
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  UserPlus,
  Users,
  Shield,
  Sparkles,
  UserCheck,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  MoreVertical,
  X,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'warden' | 'cleaner' | 'supervisor' | 'security' | string;
  roles?: string[];
  status: 'active' | 'on-leave' | 'exited' | 'suspended';
  hostelId?: {
    _id: string;
    name: string;
  };
  createdAt?: string;
  lastLogin?: string;
}

export default function StaffPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useConfirmModal();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [hostelFilter, setHostelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'warden',
    roles: ['warden'] as string[],
    hostelId: '',
    status: 'active' as 'active' | 'on-leave' | 'exited' | 'suspended',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    loadData();
  }, [user, router]);

  const loadData = async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const allStaffRoles = ['warden', 'cleaner', 'supervisor', 'security'];
      const cacheBust = Date.now();
      const allStaffPromises = allStaffRoles.map((role) => api.getUsers({ role, _: cacheBust }));
      const [hostelsList, ...allStaffResponses] = await Promise.all([
        api.getHostels({ _: cacheBust }),
        ...allStaffPromises,
      ]);
      const hostelsArray = Array.isArray(hostelsList) ? hostelsList : (hostelsList as any)?.data ?? [];
      const combined = ([] as any[]).concat(
        ...allStaffResponses.map((r: any) => (Array.isArray(r) ? r : r?.data ?? []))
      );
      const seen = new Set<string>();
      const allStaff = combined.filter((member: StaffMember) => {
        const id = member?._id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      const normalizedStaff = allStaff.map((m: any) => ({
        ...m,
        roles: Array.isArray(m.role) ? m.role : [m.role].filter(Boolean),
        role: Array.isArray(m.role) ? m.role[0] : m.role,
      }));
      setStaff((prev) => (normalizedStaff.length > 0 ? normalizedStaff : prev));
      setHostels((prev) => (hostelsArray.length > 0 ? hostelsArray : prev.length === 0 ? [] : prev));
      if (hostelsArray.length > 0) {
        setFormData((prev) => ({
          ...prev,
          hostelId: prev.hostelId || hostelsArray[0]._id || hostelsArray[0].id || '',
        }));
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to load data';
      showToast(errorMsg, 'error');
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.email || !formData.phone) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }

    if (formData.roles.length === 0) {
      showToast('Please select at least one role', 'warning');
      return;
    }

    if (!editingStaff && !formData.password) {
      showToast('Password is required for new staff members', 'warning');
      return;
    }

    const effectiveHostelId = formData.hostelId || (hostels.length > 0 ? (hostels[0]._id || hostels[0].id) : undefined);

    setSubmitting(true);
    try {
      const staffRoles = formData.roles?.length ? formData.roles : [formData.role];
      const primaryRole = staffRoles[0] || formData.role;
      if (editingStaff) {
        const updateData: any = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: staffRoles,
          roles: staffRoles,
          hostelId: effectiveHostelId,
          status: formData.status,
        };
        const newPassword = (formData.password || '').trim();
        if (newPassword.length > 0) updateData.password = newPassword;
        await api.updateUser(editingStaff._id, updateData);
        showToast('Staff member updated successfully', 'success');
        // Optimistic update: keep table populated with edited row so it never goes empty
        const hostel = hostels.find((h) => (h._id || h.id) === effectiveHostelId);
        setStaff((prev) =>
          prev.map((m) =>
            m._id === editingStaff._id
              ? {
                  ...m,
                  name: formData.name,
                  email: formData.email,
                  phone: formData.phone,
                  role: primaryRole,
                  roles: staffRoles,
                  hostelId: hostel ? { _id: hostel._id || hostel.id, name: hostel.name } : undefined,
                  status: formData.status,
                }
              : m
          )
        );
        setShowCreateModal(false);
        resetForm();
      } else {
        await api.createUser({
          ...formData,
          role: staffRoles,
          roles: staffRoles,
          hostelId: effectiveHostelId,
        });
        showToast('Staff member created successfully', 'success');
        setShowCreateModal(false);
        resetForm();
        await loadData({ silent: true });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to save staff member';
      showToast(errorMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (staffMember: StaffMember) => {
    const result = await confirm({
      title: 'Delete Staff Member',
      message: `Are you sure you want to delete ${staffMember.name}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });

    if (result) {
      try {
        await api.deleteUser(staffMember._id);
        showToast('Staff member deleted successfully', 'success');
        await loadData({ silent: true });
      } catch (error: any) {
        showToast(error.message || 'Failed to delete staff member', 'error');
      }
    }
  };

  const handleResetPassword = async (staffMember: StaffMember) => {
    const result = await confirm({
      title: 'Reset Password',
      message: `Reset password for ${staffMember.name}? A new password will be generated and sent via email.`,
      confirmText: 'Reset Password',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-blue-600 hover:bg-blue-700',
    });

    if (result) {
      setResettingPassword(staffMember._id);
      try {
        // Generate a new password
        const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '123';

        // Update user with new password
        await api.updateUser(staffMember._id, {
          password: newPassword,
        });

        showToast(`Password reset successfully! New password: ${newPassword}`, 'success');
        showToast('Password has been sent to the staff member via email', 'info');
      } catch (error: any) {
        showToast(error.message || 'Failed to reset password', 'error');
      } finally {
        setResettingPassword(null);
      }
    }
  };

  const handleEdit = (staffMember: StaffMember) => {
    setEditingStaff(staffMember);
    const memberRoles = staffMember.roles || (Array.isArray(staffMember.role) ? staffMember.role : [staffMember.role].filter(Boolean));
    setFormData({
      name: staffMember.name,
      email: staffMember.email,
      password: '',
      phone: staffMember.phone,
      role: memberRoles[0] || staffMember.role,
      roles: memberRoles as string[],
      hostelId: staffMember.hostelId?._id || '',
      status: staffMember.status,
    });
    setShowCreateModal(true);
  };

  const toggleRole = (r: string) => {
    const current = formData.roles || [];
    const next = current.includes(r)
      ? current.filter((x) => x !== r)
      : [...current, r];
    if (next.length === 0) return;
    setFormData({ ...formData, roles: next, role: next[0] });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'warden',
      roles: ['warden'],
      hostelId: hostels.length > 0 ? (hostels[0]._id || hostels[0].id) : '',
      status: 'active',
    });
    setEditingStaff(null);
  };

  const getRoleIcon = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'warden':
        return Shield;
      case 'cleaner':
        return Sparkles;
      case 'supervisor':
        return UserCheck;
      case 'security':
        return Lock;
      default:
        return Users;
    }
  };

  const getRoleDisplay = (member: StaffMember) => {
    const roles = member.roles || (Array.isArray(member.role) ? member.role : [member.role]);
    return roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ');
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'warden':
        return 'bg-blue-100 text-blue-800';
      case 'cleaner':
        return 'bg-purple-100 text-purple-800';
      case 'supervisor':
        return 'bg-green-100 text-green-800';
      case 'security':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'on-leave':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'exited':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.phone.includes(searchTerm);
    const memberRoles = member.roles || (Array.isArray(member.role) ? member.role : [member.role].filter(Boolean));
    const matchesRole = roleFilter === 'all' || memberRoles.includes(roleFilter);
    const matchesHostel =
      hostelFilter === 'all' ||
      (hostelFilter === 'unassigned' && !member.hostelId) ||
      member.hostelId?._id === hostelFilter;
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;

    return matchesSearch && matchesRole && matchesHostel && matchesStatus;
  });

  const staffByRole = {
    warden: filteredStaff.filter((s) => {
      const roles = s.roles || (Array.isArray(s.role) ? s.role : [s.role]);
      return roles.includes('warden');
    }).length,
    cleaner: filteredStaff.filter((s) => {
      const roles = s.roles || (Array.isArray(s.role) ? s.role : [s.role]);
      return roles.includes('cleaner');
    }).length,
    supervisor: filteredStaff.filter((s) => {
      const roles = s.roles || (Array.isArray(s.role) ? s.role : [s.role]);
      return roles.includes('supervisor');
    }).length,
    security: filteredStaff.filter((s) => {
      const roles = s.roles || (Array.isArray(s.role) ? s.role : [s.role]);
      return roles.includes('security');
    }).length,
  };

  const totalUniqueStaff = filteredStaff.length;

  if (loading || !user || !isOwnerUser(user)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 md:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Staff Management</h1>
                <p className="text-sm text-gray-600 mt-1">Manage wardens, cleaners, supervisors, and security guards</p>
              </div>
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Add Staff Member
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 py-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Staff</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalUniqueStaff}</p>
                </div>
                <Users className="w-8 h-8 text-gray-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Wardens</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{staffByRole.warden}</p>
                </div>
                <Shield className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Cleaners</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{staffByRole.cleaner}</p>
                </div>
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Supervisors</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{staffByRole.supervisor}</p>
                </div>
                <UserCheck className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Security</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{staffByRole.security}</p>
                </div>
                <Lock className="w-8 h-8 text-orange-400" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Roles</option>
                  <option value="warden">Warden</option>
                  <option value="cleaner">Cleaner</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="security">Security Guard</option>
                </select>
              </div>
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="on-leave">On Leave</option>
                  <option value="suspended">Suspended</option>
                  <option value="exited">Exited</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <select
                value={hostelFilter}
                onChange={(e) => setHostelFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Hostels</option>
                <option value="unassigned">Unassigned</option>
                {hostels.map((hostel) => (
                  <option key={hostel._id || hostel.id} value={hostel._id || hostel.id}>
                    {hostel.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Staff List */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {filteredStaff.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No staff members found</p>
                <button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Add your first staff member
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Staff Member
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hostel
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredStaff.map((member) => {
                      const memberRoles = member.roles || (Array.isArray(member.role) ? member.role : [member.role]);
                      const primaryRole = memberRoles[0];
                      const RoleIcon = getRoleIcon(primaryRole);
                      return (
                        <tr key={member._id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <RoleIcon className="w-5 h-5 text-gray-600" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{member.name}</div>
                                <div className="text-sm text-gray-500">{member.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {member.phone}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex flex-wrap gap-1">
                              {(member.roles || (Array.isArray(member.role) ? member.role : [member.role].filter(Boolean))).map((r) => (
                                <span
                                  key={r}
                                  className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(r)}`}
                                >
                                  {String(r).charAt(0).toUpperCase() + String(r).slice(1)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {member.hostelId?.name || (
                              <span className="text-gray-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                                member.status
                              )}`}
                            >
                              {member.status === 'on-leave' ? 'On Leave' : member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleResetPassword(member)}
                                disabled={resettingPassword === member._id}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50"
                                title="Reset Password"
                              >
                                {resettingPassword === member._id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Lock className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleEdit(member)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(member)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-opacity-10 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
                </h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Password {!editingStaff && <span className="text-red-500">*</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={editingStaff ? 'Leave blank to keep current' : 'Password'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {editingStaff && (
                      <p className="text-xs text-gray-500 mt-1">Leave blank to keep current password</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Roles <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-gray-500 mb-2">Select one or more roles for this staff member</p>
                    <div className="flex flex-wrap gap-3">
                      {(['warden', 'cleaner', 'supervisor', 'security'] as const).map((r) => (
                        <label key={r} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(formData.roles || []).includes(r)}
                            onChange={() => toggleRole(r)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700 capitalize">{r === 'security' ? 'Security Guard' : r}</span>
                        </label>
                      ))}
                    </div>
                    {formData.roles.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">Please select at least one role</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Hostel <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.hostelId || (hostels.length > 0 ? (hostels[0]._id || hostels[0].id) : '')}
                      onChange={(e) => setFormData({ ...formData, hostelId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {hostels.length === 0 ? (
                        <option value="">No hostels available</option>
                      ) : (
                        hostels.map((hostel) => (
                          <option key={hostel._id || hostel.id} value={hostel._id || hostel.id}>
                            {hostel.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as any })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="on-leave">On Leave</option>
                      <option value="suspended">Suspended</option>
                      <option value="exited">Exited</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {editingStaff ? 'Updating...' : 'Creating...'}
                    </>
                  ) : editingStaff ? (
                    'Update Staff Member'
                  ) : (
                    'Create Staff Member'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
