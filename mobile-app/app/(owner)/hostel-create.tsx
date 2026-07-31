import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';

const SECTIONS = [
  { id: 'basic', label: 'Basic Info', icon: 'information-circle-outline' as const },
  { id: 'images', label: 'Images', icon: 'images-outline' as const },
  { id: 'address', label: 'Address', icon: 'location-outline' as const },
  { id: 'contact', label: 'Contact', icon: 'call-outline' as const },
  { id: 'pricing', label: 'Pricing', icon: 'wallet-outline' as const },
  { id: 'amenities', label: 'Amenities', icon: 'star-outline' as const },
  { id: 'facilities', label: 'Facilities', icon: 'construct-outline' as const },
  { id: 'rules', label: 'Rules', icon: 'document-text-outline' as const },
  { id: 'business', label: 'Business', icon: 'business-outline' as const },
];

const defaultForm = {
  name: '',
  type: 'boys',
  description: '',
  shortDescription: '',
  capacity: '',
  totalRooms: '',
  totalBlocks: '',
  totalFloors: '',
  address: { street: '', city: '', state: '', pincode: '', country: 'India' },
  contact: {
    phone: '', email: '', alternatePhone: '',
    managerName: '', managerPhone: '', managerEmail: '',
    wardenName: '', wardenPhone: '', wardenEmail: '',
  },
  pricing: {
    minRent: '', maxRent: '', securityDeposit: '', maintenanceCharges: '',
    electricityCharges: 'separate', waterCharges: 'included', currency: 'INR',
  },
  operatingHours: { officeHours: '', checkInTime: '', checkOutTime: '', maintenanceHours: '' },
  amenities: {
    wifi: false, wifiSpeed: '', wifiCost: '',
    laundry: false, laundryType: 'self-service', laundryCost: '',
    mess: false, messType: 'both', messCost: '',
    parking: false, parkingType: 'two-wheeler', parkingCost: '',
    gym: false, library: false, commonRoom: false, tvRoom: false, studyRoom: false,
  },
  facilities: {
    security: false, securityGuards: '', cctv: false, cctvCount: '',
    powerBackup: false, powerBackupHours: '', waterSupply: true, waterSupplyType: '24x7',
    medicalFacility: false, sportsFacility: false, fireSafety: false, lift: false, generator: false,
  },
  rules: {
    curfewTime: '', weekendCurfewTime: '', lateEntryAllowed: false, lateEntryFine: '',
    visitorAllowed: true, visitorTimings: '', smokingAllowed: false, alcoholAllowed: false,
    petsAllowed: false, oppositeGenderAllowed: false,
    messTimings: { breakfast: '', lunch: '', dinner: '' },
  },
  businessInfo: {
    gstNumber: '', licenseNumber: '', registrationNumber: '', panNumber: '',
    bankAccountNumber: '', bankName: '', ifscCode: '', accountHolderName: '',
  },
  highlights: [] as string[],
  tags: [] as string[],
  status: 'active',
};

export default function HostelCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeSection, setActiveSection] = useState('basic');
  const [form, setForm] = useState<any>({ ...defaultForm });
  const [loading, setLoading] = useState(false);
  const [highlightInput, setHighlightInput] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const buildSubmitData = () => {
    const raw = {
      ...form,
      capacity: parseInt(form.capacity) || 0,
      totalRooms: parseInt(form.totalRooms) || 0,
      totalBlocks: parseInt(form.totalBlocks) || 0,
      totalFloors: parseInt(form.totalFloors) || 0,
      pricing: {
        ...form.pricing,
        minRent: parseFloat(form.pricing.minRent) || 0,
        maxRent: parseFloat(form.pricing.maxRent) || 0,
        securityDeposit: parseFloat(form.pricing.securityDeposit) || 0,
        maintenanceCharges: parseFloat(form.pricing.maintenanceCharges) || 0,
      },
      facilities: {
        ...form.facilities,
        securityGuards: parseInt(form.facilities.securityGuards) || 0,
        cctvCount: parseInt(form.facilities.cctvCount) || 0,
        powerBackupHours: parseInt(form.facilities.powerBackupHours) || 0,
      },
      amenities: {
        ...form.amenities,
        wifiCost: parseFloat(form.amenities.wifiCost) || 0,
        laundryCost: parseFloat(form.amenities.laundryCost) || 0,
        messCost: parseFloat(form.amenities.messCost) || 0,
        parkingCost: parseFloat(form.amenities.parkingCost) || 0,
      },
      rules: {
        ...form.rules,
        lateEntryFine: parseFloat(form.rules.lateEntryFine) || 0,
      },
    };
    if (raw.address && (raw.address.coordinates === undefined || raw.address.coordinates === null)) {
      const { coordinates: _c, ...restAddress } = raw.address;
      raw.address = restAddress;
    } else if (raw.address?.coordinates && (typeof raw.address.coordinates.latitude !== 'number' || typeof raw.address.coordinates.longitude !== 'number')) {
      const { coordinates: _c, ...restAddress } = raw.address;
      raw.address = restAddress;
    }
    return raw;
  };

  const pickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to add hostel images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        setImageUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to pick images');
    }
  };

  const removeImage = (index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPickedImages = async (hostelId: string): Promise<void> => {
    if (imageUris.length === 0) return;
    setUploadingImages(true);
    try {
      const formData = new FormData();
      imageUris.forEach((uri, index) => {
        const filename = uri.split('/').pop() || `image_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('images', { uri, name: filename, type } as any);
      });
      await api.uploadHostelImages(hostelId, formData);
    } catch (error: any) {
      Alert.alert('Upload warning', 'Hostel created but some images failed to upload. You can add them from the hostel detail.');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name?.trim() || !form.capacity?.trim()) {
      Alert.alert('Required', 'Please fill Name and Capacity');
      return;
    }
    setLoading(true);
    try {
      const response = await api.createHostel(buildSubmitData());
      const resData = (response as any)?.data ?? response;
      const newId = resData?._id ?? resData?.id;
      if (newId && imageUris.length > 0) {
        await uploadPickedImages(newId);
      }
      Alert.alert('Success', 'Hostel created successfully', [
        {
          text: 'View Hostel',
          onPress: () => {
            if (newId) router.replace({ pathname: '/(owner)/hostel-detail', params: { id: newId } } as any);
            else router.back();
          },
        },
        { text: 'Back to List', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to create hostel');
    } finally {
      setLoading(false);
    }
  };

  const addHighlight = () => {
    if (highlightInput.trim()) {
      setForm({ ...form, highlights: [...(form.highlights || []), highlightInput.trim()] });
      setHighlightInput('');
    }
  };

  const removeHighlight = (i: number) => {
    setForm({ ...form, highlights: (form.highlights || []).filter((_: any, index: number) => index !== i) });
  };

  const renderSection = () => {
    const set = (path: string, value: any) => {
      const parts = path.split('.');
      const next = { ...form };
      let cur: any = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (!(key in cur)) cur[key] = {};
        cur[key] = { ...cur[key] };
        cur = cur[key];
      }
      cur[parts[parts.length - 1]] = value;
      setForm(next);
    };

    switch (activeSection) {
      case 'basic':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            <TextInput style={styles.input} placeholder="Hostel Name *" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
            <View style={styles.row}>
              {['boys', 'girls', 'co-ed'].map((t) => (
                <TouchableOpacity key={t} style={[styles.chip, form.type === t && styles.chipActive]} onPress={() => setForm({ ...form, type: t })}>
                  <Text style={[styles.chipText, form.type === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[styles.input, styles.area]} placeholder="Short Description" value={form.shortDescription} onChangeText={(t) => setForm({ ...form, shortDescription: t })} multiline />
            <TextInput style={[styles.input, styles.area]} placeholder="Full Description" value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} multiline numberOfLines={4} />
            <TextInput style={styles.input} placeholder="Total Capacity *" value={form.capacity} onChangeText={(t) => setForm({ ...form, capacity: t })} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Total Rooms" value={form.totalRooms} onChangeText={(t) => setForm({ ...form, totalRooms: t })} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Total Blocks" value={form.totalBlocks} onChangeText={(t) => setForm({ ...form, totalBlocks: t })} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Total Floors" value={form.totalFloors} onChangeText={(t) => setForm({ ...form, totalFloors: t })} keyboardType="numeric" />
            <View style={styles.tagWrap}>
              <Text style={styles.label}>Highlights</Text>
              <View style={styles.tagRow}>
                <TextInput style={[styles.input, styles.tagInput]} placeholder="Add highlight" value={highlightInput} onChangeText={setHighlightInput} onSubmitEditing={addHighlight} />
                <TouchableOpacity style={styles.addTagBtn} onPress={addHighlight}><Ionicons name="add" size={20} color="#fff" /></TouchableOpacity>
              </View>
              <View style={styles.tags}>
                {(form.highlights || []).map((h: string, i: number) => (
                  <TouchableOpacity key={i} style={styles.tag} onPress={() => removeHighlight(i)}>
                    <Text style={styles.tagText}>{h}</Text>
                    <Ionicons name="close" size={14} color="#64748b" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        );
      case 'images':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hostel Images</Text>
            <Text style={styles.imageHint}>Add photos for your hostel. First image can be set as cover from the hostel detail after creation.</Text>
            <TouchableOpacity style={styles.addImagesBtn} onPress={pickImages}>
              <Ionicons name="images-outline" size={28} color="#0a7ea4" />
              <Text style={styles.addImagesBtnText}>Add photos</Text>
            </TouchableOpacity>
            {imageUris.length > 0 ? (
              <View style={styles.imageGrid}>
                {imageUris.map((uri, index) => (
                  <View key={index} style={styles.imageWrap}>
                    <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(index)}>
                      <Ionicons name="close" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      case 'address':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Address</Text>
            <TextInput style={styles.input} placeholder="Street" value={form.address.street} onChangeText={(t) => setForm({ ...form, address: { ...form.address, street: t } })} />
            <TextInput style={styles.input} placeholder="City" value={form.address.city} onChangeText={(t) => setForm({ ...form, address: { ...form.address, city: t } })} />
            <TextInput style={styles.input} placeholder="State" value={form.address.state} onChangeText={(t) => setForm({ ...form, address: { ...form.address, state: t } })} />
            <TextInput style={styles.input} placeholder="Pincode" value={form.address.pincode} onChangeText={(t) => setForm({ ...form, address: { ...form.address, pincode: t } })} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Country" value={form.address.country} onChangeText={(t) => setForm({ ...form, address: { ...form.address, country: t } })} />
          </View>
        );
      case 'contact':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <TextInput style={styles.input} placeholder="Phone" value={form.contact.phone} onChangeText={(t) => setForm({ ...form, contact: { ...form.contact, phone: t } })} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Email" value={form.contact.email} onChangeText={(t) => setForm({ ...form, contact: { ...form.contact, email: t } })} keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Alternate Phone" value={form.contact.alternatePhone} onChangeText={(t) => setForm({ ...form, contact: { ...form.contact, alternatePhone: t } })} keyboardType="phone-pad" />
            <Text style={styles.subSectionTitle}>Manager</Text>
            <TextInput style={styles.input} placeholder="Manager Name" value={form.contact.managerName} onChangeText={(t) => setForm({ ...form, contact: { ...form.contact, managerName: t } })} />
            <TextInput style={styles.input} placeholder="Manager Phone" value={form.contact.managerPhone} onChangeText={(t) => setForm({ ...form, contact: { ...form.contact, managerPhone: t } })} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Manager Email" value={form.contact.managerEmail} onChangeText={(t) => setForm({ ...form, contact: { ...form.contact, managerEmail: t } })} keyboardType="email-address" />
            <Text style={styles.subSectionTitle}>Warden</Text>
            <TextInput style={styles.input} placeholder="Warden Name" value={form.contact.wardenName} onChangeText={(t) => setForm({ ...form, contact: { ...form.contact, wardenName: t } })} />
            <TextInput style={styles.input} placeholder="Warden Phone" value={form.contact.wardenPhone} onChangeText={(t) => setForm({ ...form, contact: { ...form.contact, wardenPhone: t } })} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Warden Email" value={form.contact.wardenEmail} onChangeText={(t) => setForm({ ...form, contact: { ...form.contact, wardenEmail: t } })} keyboardType="email-address" />
          </View>
        );
      case 'pricing':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing</Text>
            <TextInput style={styles.input} placeholder="Min Rent (₹)" value={form.pricing.minRent} onChangeText={(t) => setForm({ ...form, pricing: { ...form.pricing, minRent: t } })} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Max Rent (₹)" value={form.pricing.maxRent} onChangeText={(t) => setForm({ ...form, pricing: { ...form.pricing, maxRent: t } })} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Security Deposit (₹)" value={form.pricing.securityDeposit} onChangeText={(t) => setForm({ ...form, pricing: { ...form.pricing, securityDeposit: t } })} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Maintenance Charges (₹)" value={form.pricing.maintenanceCharges} onChangeText={(t) => setForm({ ...form, pricing: { ...form.pricing, maintenanceCharges: t } })} keyboardType="numeric" />
          </View>
        );
      case 'amenities':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            {['wifi', 'laundry', 'mess', 'parking', 'gym', 'library', 'commonRoom', 'tvRoom', 'studyRoom'].map((key) => (
              <TouchableOpacity key={key} style={styles.switchRow} onPress={() => setForm({ ...form, amenities: { ...form.amenities, [key]: !form.amenities[key] } })}>
                <Text style={styles.switchLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                <View style={[styles.toggle, form.amenities[key] && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, form.amenities[key] && styles.toggleThumbOn]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        );
      case 'facilities':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Facilities</Text>
            {['security', 'cctv', 'powerBackup', 'waterSupply', 'medicalFacility', 'sportsFacility', 'fireSafety', 'lift', 'generator'].map((key) => (
              <TouchableOpacity key={key} style={styles.switchRow} onPress={() => setForm({ ...form, facilities: { ...form.facilities, [key]: !form.facilities[key] } })}>
                <Text style={styles.switchLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                <View style={[styles.toggle, form.facilities[key] && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, form.facilities[key] && styles.toggleThumbOn]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        );
      case 'rules':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rules</Text>
            <TextInput style={styles.input} placeholder="Curfew Time" value={form.rules.curfewTime} onChangeText={(t) => setForm({ ...form, rules: { ...form.rules, curfewTime: t } })} />
            <TextInput style={styles.input} placeholder="Weekend Curfew" value={form.rules.weekendCurfewTime} onChangeText={(t) => setForm({ ...form, rules: { ...form.rules, weekendCurfewTime: t } })} />
            <TextInput style={styles.input} placeholder="Late Entry Fine (₹)" value={form.rules.lateEntryFine} onChangeText={(t) => setForm({ ...form, rules: { ...form.rules, lateEntryFine: t } })} keyboardType="numeric" />
          </View>
        );
      case 'business':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Info</Text>
            <TextInput style={styles.input} placeholder="GST Number" value={form.businessInfo.gstNumber} onChangeText={(t) => setForm({ ...form, businessInfo: { ...form.businessInfo, gstNumber: t } })} />
            <TextInput style={styles.input} placeholder="License Number" value={form.businessInfo.licenseNumber} onChangeText={(t) => setForm({ ...form, businessInfo: { ...form.businessInfo, licenseNumber: t } })} />
            <TextInput style={styles.input} placeholder="PAN Number" value={form.businessInfo.panNumber} onChangeText={(t) => setForm({ ...form, businessInfo: { ...form.businessInfo, panNumber: t } })} />
            <TextInput style={styles.input} placeholder="Bank Name" value={form.businessInfo.bankName} onChangeText={(t) => setForm({ ...form, businessInfo: { ...form.businessInfo, bankName: t } })} />
            <TextInput style={styles.input} placeholder="Account Number" value={form.businessInfo.bankAccountNumber} onChangeText={(t) => setForm({ ...form, businessInfo: { ...form.businessInfo, bankAccountNumber: t } })} />
            <TextInput style={styles.input} placeholder="IFSC Code" value={form.businessInfo.ifscCode} onChangeText={(t) => setForm({ ...form, businessInfo: { ...form.businessInfo, ifscCode: t.toUpperCase() } })} autoCapitalize="characters" />
            <TextInput style={styles.input} placeholder="Account Holder Name" value={form.businessInfo.accountHolderName} onChangeText={(t) => setForm({ ...form, businessInfo: { ...form.businessInfo, accountHolderName: t } })} />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>Create New Hostel</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
        {SECTIONS.map((s) => (
          <TouchableOpacity key={s.id} style={[styles.tab, activeSection === s.id && styles.tabActive]} onPress={() => setActiveSection(s.id)}>
            <Ionicons name={s.icon} size={18} color={activeSection === s.id ? '#fff' : '#64748b'} />
            <Text style={[styles.tabText, activeSection === s.id && styles.tabTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {renderSection()}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Hostel</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  placeholder: { width: 40 },
  tabs: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', maxHeight: 52 },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  tabActive: { backgroundColor: '#0a7ea4' },
  tabText: { fontSize: 13, color: '#64748b' },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  subSectionTitle: { fontSize: 14, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12, backgroundColor: '#fff' },
  area: { minHeight: 80, textAlignVertical: 'top' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: '#0a7ea4' },
  chipText: { fontSize: 14, color: '#64748b' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  tagWrap: { marginTop: 8 },
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tagInput: { flex: 1, marginBottom: 0 },
  addTagBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#0a7ea4', alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },
  tagText: { fontSize: 13, color: '#475569' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  switchLabel: { fontSize: 15, color: '#0f172a' },
  toggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: '#e2e8f0', justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: '#0a7ea4' },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },
  submitBtn: { marginTop: 16, paddingVertical: 16, borderRadius: 12, backgroundColor: '#0a7ea4', alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  imageHint: { fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 18 },
  addImagesBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12, borderWidth: 2, borderColor: '#0a7ea4', borderStyle: 'dashed', marginBottom: 12 },
  addImagesBtnText: { fontSize: 15, fontWeight: '600', color: '#0a7ea4' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageWrap: { width: 100, height: 100, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  removeImageBtn: { position: 'absolute', top: 4, right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
});
