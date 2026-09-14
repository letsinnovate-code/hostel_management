import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateUser, logout } = useAuth();
  const { showToast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    studentId: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
    },
    parentInfo: {
      name: '',
      relationship: 'Parent',
      phone: '',
      email: '',
      address: '',
      occupation: '',
    },
  });

  const loadProfile = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await api.getProfile();
      if (response?.data) {
        setProfile(response.data);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Extract resolved student data
  const studentProfile = profile?.profile || user;
  const onboarding = profile?.onboarding;

  const profileImage =
    studentProfile?.profileImage ||
    user?.profileImage ||
    onboarding?.documents?.find((d: any) => d.documentType === 'photograph' || d.documentType === 'photo')?.url ||
    '';

  const studentName = studentProfile?.name || user?.name || onboarding?.personalInfo?.fullName || 'Resident Student';
  const studentPhone = studentProfile?.phone || user?.phone || onboarding?.personalInfo?.phone || '';
  const studentEmail = studentProfile?.email || user?.email || onboarding?.personalInfo?.email || '';

  const roomNo =
    (typeof studentProfile?.roomId === 'object' && studentProfile?.roomId?.roomNumber)
      ? studentProfile.roomId.roomNumber
      : (studentProfile?.room || onboarding?.roomId?.roomNumber || onboarding?.bedNumber || 'Not Allocated');

  const bedNo = onboarding?.bedNumber || studentProfile?.bedNumber || '';
  const blockName = studentProfile?.blockId?.name || (typeof studentProfile?.roomId === 'object' ? studentProfile?.roomId?.block : '') || '';

  const studentId =
    studentProfile?.studentId ||
    studentProfile?.academicInfo?.studentIdNumber ||
    onboarding?.academicInfo?.studentIdNumber ||
    studentProfile?.admissionNumber ||
    user?.studentId ||
    'Not Assigned';

  const hostelName =
    (typeof studentProfile?.hostelId === 'object' && studentProfile?.hostelId?.name)
      ? studentProfile.hostelId.name
      : (profile?.hostel?.name || onboarding?.hostelId?.name || user?.hostelName || 'Hostel');

  const addressObj = studentProfile?.address || onboarding?.personalInfo?.address || {};
  const parentData = studentProfile?.parentInfo || studentProfile?.parentContact || onboarding?.parentInfo || {};

  // Setup form data when entering edit mode
  const startEditing = () => {
    setFormData({
      name: studentName,
      phone: studentPhone,
      studentId: studentId !== 'Not Assigned' ? studentId : '',
      address: {
        street: typeof addressObj === 'object' ? (addressObj.street || '') : '',
        city: typeof addressObj === 'object' ? (addressObj.city || '') : '',
        state: typeof addressObj === 'object' ? (addressObj.state || '') : '',
        pincode: typeof addressObj === 'object' ? (addressObj.pincode || '') : '',
        country: typeof addressObj === 'object' ? (addressObj.country || 'India') : 'India',
      },
      parentInfo: {
        name: parentData.name || '',
        relationship: parentData.relationship || parentData.relation || 'Parent',
        phone: parentData.phone || '',
        email: parentData.email || '',
        address: parentData.address || '',
        occupation: parentData.occupation || '',
      },
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need photo library permissions to update your profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const imagePayload = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;

        setUploadingImage(true);
        try {
          const res = await api.updateProfile({ profileImage: imagePayload });
          if (res?.data) {
            updateUser(res.data);
          }
          showToast('Profile picture updated');
          await loadProfile();
        } catch (err: any) {
          Alert.alert('Error', err.message || 'Failed to update profile picture');
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to pick image');
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation', 'Please provide student name');
      return;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Validation', 'Please provide a valid phone number');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        studentId: formData.studentId.trim(),
        address: formData.address,
        parentInfo: formData.parentInfo,
        parentContact: formData.parentInfo,
      };

      const response = await api.updateProfile(payload);
      if (response?.data) {
        updateUser(response.data);
      }
      setEditing(false);
      showToast('Profile details updated successfully');
      await loadProfile();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) {
      Alert.alert('Notice', 'No phone number available to call');
      return;
    }
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanNumber}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call from this device');
    });
  };

  const handleEmail = (emailAddress?: string) => {
    if (!emailAddress) {
      Alert.alert('Notice', 'No email address available');
      return;
    }
    Linking.openURL(`mailto:${emailAddress}`).catch(() => {
      Alert.alert('Error', 'Unable to open email client');
    });
  };

  const handleLogout = () => {
    Alert.alert('Confirm Logout', 'Are you sure you want to log out of Hostelzify?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            await logout();
          } catch (error: any) {
            Alert.alert('Error', 'Failed to log out');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const getInitials = (name: string) => {
    if (!name) return 'ST';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatAddress = (addr: any) => {
    if (!addr) return 'No address registered';
    if (typeof addr === 'string') return addr.trim() || 'No address registered';
    const parts = [addr.street, addr.city, addr.state, addr.pincode, addr.country].filter(
      (p) => p && typeof p === 'string' && p.trim()
    );
    return parts.length > 0 ? parts.join(', ') : 'No address registered';
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading student profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.mainWrapper}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadProfile(true)}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
      >
        {/* Top Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBackBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Student Profile</Text>
          {!editing ? (
            <TouchableOpacity style={styles.navActionBtn} onPress={startEditing}>
              <Ionicons name="create-outline" size={18} color="#2563eb" />
              <Text style={styles.navActionText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editActionsGroup}>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelEditing} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Hero Profile Card */}
        <View style={styles.heroCard}>
          <View style={styles.avatarContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{getInitials(studentName)}</Text>
              </View>
            )}

            {/* Camera Overlay Badge for Student Pic */}
            <TouchableOpacity
              style={styles.cameraBadge}
              onPress={handlePickImage}
              disabled={uploadingImage}
              activeOpacity={0.8}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="camera" size={18} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.heroName}>{studentName}</Text>

          {/* Student ID & Status Badges */}
          <View style={styles.badgeRow}>
            <View style={styles.idBadge}>
              <Ionicons name="card-outline" size={14} color="#1e40af" />
              <Text style={styles.idBadgeText}>ID: {studentId}</Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.statusBadgeText}>Student Resident</Text>
            </View>
          </View>

          {/* Quick Highlight Ribbon: Hostel, Room & Phone */}
          <View style={styles.quickRibbon}>
            <View style={styles.ribbonItem}>
              <Ionicons name="business-outline" size={18} color="#2563eb" />
              <Text style={styles.ribbonLabel}>Hostel</Text>
              <Text style={styles.ribbonValue} numberOfLines={1}>
                {hostelName}
              </Text>
            </View>
            <View style={styles.ribbonDivider} />
            <View style={styles.ribbonItem}>
              <Ionicons name="bed-outline" size={18} color="#059669" />
              <Text style={styles.ribbonLabel}>Room</Text>
              <Text style={styles.ribbonValue} numberOfLines={1}>
                {roomNo}
              </Text>
            </View>
            <View style={styles.ribbonDivider} />
            <TouchableOpacity
              style={styles.ribbonItem}
              onPress={() => handleCall(studentPhone)}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={18} color="#d97706" />
              <Text style={styles.ribbonLabel}>Phone</Text>
              <Text style={styles.ribbonValue} numberOfLines={1}>
                {studentPhone ? 'Call' : 'N/A'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 1: Personal Information */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: '#eff6ff' }]}>
              <Ionicons name="person" size={18} color="#2563eb" />
            </View>
            <View style={styles.sectionHeaderTextWrap}>
              <Text style={styles.sectionTitle}>Personal Details</Text>
              <Text style={styles.sectionSubtitle}>Your identity and contact info</Text>
            </View>
          </View>

          <View style={styles.sectionBody}>
            {/* Student Name */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Student Full Name</Text>
              {editing ? (
                <TextInput
                  style={styles.inputField}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94a3b8"
                />
              ) : (
                <Text style={styles.fieldValueText}>{studentName}</Text>
              )}
            </View>

            {/* Student ID */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Student ID / Enrollment</Text>
              {editing ? (
                <TextInput
                  style={styles.inputField}
                  value={formData.studentId}
                  onChangeText={(text) => setFormData({ ...formData, studentId: text })}
                  placeholder="e.g. STU-2024-001"
                  placeholderTextColor="#94a3b8"
                />
              ) : (
                <View style={styles.flexRowBetween}>
                  <Text style={styles.fieldValueText}>{studentId}</Text>
                  <View style={styles.verifiedTag}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.verifiedTagText}>Registered</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Phone Number */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              {editing ? (
                <TextInput
                  style={styles.inputField}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                  placeholderTextColor="#94a3b8"
                />
              ) : (
                <View style={styles.flexRowBetween}>
                  <Text style={styles.fieldValueText}>{studentPhone || 'Not provided'}</Text>
                  {studentPhone ? (
                    <TouchableOpacity
                      style={styles.inlineActionBtn}
                      onPress={() => handleCall(studentPhone)}
                    >
                      <Ionicons name="call" size={14} color="#2563eb" />
                      <Text style={styles.inlineActionText}>Call</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>

            {/* Email Address */}
            <View style={[styles.fieldRow, styles.noBorderField]}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={styles.flexRowBetween}>
                <Text style={[styles.fieldValueText, { flex: 1 }]}>{studentEmail || 'Not provided'}</Text>
                {studentEmail ? (
                  <TouchableOpacity
                    style={styles.inlineActionBtn}
                    onPress={() => handleEmail(studentEmail)}
                  >
                    <Ionicons name="mail" size={14} color="#2563eb" />
                    <Text style={styles.inlineActionText}>Email</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* Section 2: Hostel & Accommodation */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: '#f0fdf4' }]}>
              <Ionicons name="business" size={18} color="#059669" />
            </View>
            <View style={styles.sectionHeaderTextWrap}>
              <Text style={styles.sectionTitle}>Hostel & Room Allocation</Text>
              <Text style={styles.sectionSubtitle}>Current stay and room assignment</Text>
            </View>
          </View>

          <View style={styles.sectionBody}>
            {/* Hostel Name */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Hostel Name</Text>
              <View style={styles.flexRowAlign}>
                <Ionicons name="location-sharp" size={16} color="#64748b" style={{ marginRight: 6 }} />
                <Text style={styles.fieldValueText}>{hostelName}</Text>
              </View>
            </View>

            {/* Room Number & Details */}
            <View style={[styles.fieldRow, styles.noBorderField]}>
              <Text style={styles.fieldLabel}>Room Number</Text>
              <View style={styles.flexRowBetween}>
                <View style={styles.roomTagWrap}>
                  <Ionicons name="key" size={16} color="#059669" />
                  <Text style={styles.roomTagText}>{roomNo}</Text>
                </View>
                {bedNo ? (
                  <View style={styles.bedTagWrap}>
                    <Text style={styles.bedTagText}>{bedNo}</Text>
                  </View>
                ) : null}
              </View>
              {blockName ? (
                <Text style={styles.blockSubtext}>Block / Wing: {blockName}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Section 3: Permanent Address */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="location" size={18} color="#d97706" />
            </View>
            <View style={styles.sectionHeaderTextWrap}>
              <Text style={styles.sectionTitle}>Permanent Address</Text>
              <Text style={styles.sectionSubtitle}>Registered residential details</Text>
            </View>
          </View>

          <View style={styles.sectionBody}>
            {!editing ? (
              <View style={styles.addressViewWrap}>
                <Ionicons name="map-outline" size={20} color="#64748b" style={styles.addressIcon} />
                <Text style={styles.addressFullText}>{formatAddress(addressObj)}</Text>
              </View>
            ) : (
              <View style={styles.addressInputsWrap}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Street / Area</Text>
                  <TextInput
                    style={styles.inputField}
                    value={formData.address.street}
                    onChangeText={(text) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, street: text },
                      })
                    }
                    placeholder="House / Flat no, Street, Area"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.gridTwoColumns}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.inputLabel}>City</Text>
                    <TextInput
                      style={styles.inputField}
                      value={formData.address.city}
                      onChangeText={(text) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, city: text },
                        })
                      }
                      placeholder="City"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.inputLabel}>State</Text>
                    <TextInput
                      style={styles.inputField}
                      value={formData.address.state}
                      onChangeText={(text) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, state: text },
                        })
                      }
                      placeholder="State"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <View style={styles.gridTwoColumns}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.inputLabel}>PIN / ZIP Code</Text>
                    <TextInput
                      style={styles.inputField}
                      value={formData.address.pincode}
                      onChangeText={(text) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, pincode: text },
                        })
                      }
                      placeholder="PIN Code"
                      keyboardType="numeric"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.inputLabel}>Country</Text>
                    <TextInput
                      style={styles.inputField}
                      value={formData.address.country}
                      onChangeText={(text) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, country: text },
                        })
                      }
                      placeholder="Country"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Section 4: Parent & Guardian Information */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="people" size={18} color="#9333ea" />
            </View>
            <View style={styles.sectionHeaderTextWrap}>
              <Text style={styles.sectionTitle}>Parent / Guardian Information</Text>
              <Text style={styles.sectionSubtitle}>Emergency and guardian contacts</Text>
            </View>
          </View>

          <View style={styles.sectionBody}>
            {!editing ? (
              <>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Parent / Guardian Name</Text>
                  <View style={styles.flexRowBetween}>
                    <Text style={styles.fieldValueText}>{parentData?.name || 'Not provided'}</Text>
                    {parentData?.relationship || parentData?.relation ? (
                      <View style={styles.relationPill}>
                        <Text style={styles.relationPillText}>{parentData.relationship || parentData.relation}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Parent Contact Phone</Text>
                  <View style={styles.flexRowBetween}>
                    <Text style={styles.fieldValueText}>{parentData?.phone || 'Not provided'}</Text>
                    {parentData?.phone ? (
                      <TouchableOpacity
                        style={[styles.inlineActionBtn, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}
                        onPress={() => handleCall(parentData.phone)}
                      >
                        <Ionicons name="call" size={14} color="#059669" />
                        <Text style={[styles.inlineActionText, { color: '#059669' }]}>Call Parent</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {parentData?.email ? (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Parent Email</Text>
                    <View style={styles.flexRowBetween}>
                      <Text style={[styles.fieldValueText, { flex: 1 }]}>{parentData.email}</Text>
                      <TouchableOpacity
                        style={styles.inlineActionBtn}
                        onPress={() => handleEmail(parentData.email)}
                      >
                        <Ionicons name="mail" size={14} color="#2563eb" />
                        <Text style={styles.inlineActionText}>Email</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {parentData?.occupation ? (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Occupation</Text>
                    <Text style={styles.fieldValueText}>{parentData.occupation}</Text>
                  </View>
                ) : null}

                {parentData?.address ? (
                  <View style={[styles.fieldRow, styles.noBorderField]}>
                    <Text style={styles.fieldLabel}>Parent Residence</Text>
                    <Text style={styles.fieldValueText}>{parentData.address}</Text>
                  </View>
                ) : null}

                {!parentData?.name && !parentData?.phone ? (
                  <View style={styles.emptyNotice}>
                    <Ionicons name="information-circle-outline" size={18} color="#94a3b8" />
                    <Text style={styles.emptyNoticeText}>
                      No parent details recorded yet. Tap "Edit" above to enter parent information.
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.addressInputsWrap}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Parent / Guardian Full Name</Text>
                  <TextInput
                    style={styles.inputField}
                    value={formData.parentInfo.name}
                    onChangeText={(text) =>
                      setFormData({
                        ...formData,
                        parentInfo: { ...formData.parentInfo, name: text },
                      })
                    }
                    placeholder="e.g. Robert Smith"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.gridTwoColumns}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.inputLabel}>Relationship</Text>
                    <TextInput
                      style={styles.inputField}
                      value={formData.parentInfo.relationship}
                      onChangeText={(text) =>
                        setFormData({
                          ...formData,
                          parentInfo: { ...formData.parentInfo, relationship: text },
                        })
                      }
                      placeholder="Father / Mother / Guardian"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <TextInput
                      style={styles.inputField}
                      value={formData.parentInfo.phone}
                      onChangeText={(text) =>
                        setFormData({
                          ...formData,
                          parentInfo: { ...formData.parentInfo, phone: text },
                        })
                      }
                      placeholder="Parent's phone"
                      keyboardType="phone-pad"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address (Optional)</Text>
                  <TextInput
                    style={styles.inputField}
                    value={formData.parentInfo.email}
                    onChangeText={(text) =>
                      setFormData({
                        ...formData,
                        parentInfo: { ...formData.parentInfo, email: text },
                      })
                    }
                    placeholder="parent@example.com"
                    keyboardType="email-address"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Occupation (Optional)</Text>
                  <TextInput
                    style={styles.inputField}
                    value={formData.parentInfo.occupation}
                    onChangeText={(text) =>
                      setFormData({
                        ...formData,
                        parentInfo: { ...formData.parentInfo, occupation: text },
                      })
                    }
                    placeholder="e.g. Engineer, Business, Teacher"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Address (if different)</Text>
                  <TextInput
                    style={styles.inputField}
                    value={formData.parentInfo.address}
                    onChangeText={(text) =>
                      setFormData({
                        ...formData,
                        parentInfo: { ...formData.parentInfo, address: text },
                      })
                    }
                    placeholder="Parent's residential address"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Edit Mode Save / Cancel Button Bar */}
        {editing ? (
          <View style={styles.editBottomBar}>
            <TouchableOpacity
              style={styles.saveBigButton}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={styles.saveBigButtonText}>Save Profile Changes</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBigButton}
              onPress={cancelEditing}
              disabled={saving}
            >
              <Text style={styles.cancelBigButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Logout Button */}
        {!editing ? (
          <TouchableOpacity
            style={[styles.logoutButton, loggingOut && { opacity: 0.7 }]}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.8}
          >
            {loggingOut ? (
              <ActivityIndicator color="#ef4444" size="small" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                <Text style={styles.logoutButtonText}>Log Out</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },

  // Navigation Bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 8,
  },
  navBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  navActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  navActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  editActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: '#eff6ff',
  },
  avatarFallback: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#dbeafe',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#2563eb',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  idBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
  },

  // Quick Ribbon
  quickRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ribbonItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbonLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  ribbonValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
    textAlign: 'center',
  },
  ribbonDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e2e8f0',
  },

  // Section Cards
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionHeaderTextWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  sectionBody: {
    padding: 16,
  },

  // Field Rows
  fieldRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  noBorderField: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldValueText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  flexRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flexRowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  verifiedTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  inlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  inlineActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },

  // Room & Bed Tags
  roomTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  roomTagText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065f46',
  },
  bedTagWrap: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  bedTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  blockSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
  },

  // Address View
  addressViewWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  addressFullText: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 22,
    fontWeight: '500',
  },

  // Parent Info Pill
  relationPill: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  relationPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7e22ce',
  },
  emptyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  emptyNoticeText: {
    fontSize: 13,
    color: '#94a3b8',
    flex: 1,
  },

  // Inputs in Edit Mode
  addressInputsWrap: {
    gap: 12,
  },
  inputGroup: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
  },
  gridTwoColumns: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Bottom Buttons
  editBottomBar: {
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  saveBigButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBigButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBigButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBigButtonText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },

  // Logout Button
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '700',
  },
});
