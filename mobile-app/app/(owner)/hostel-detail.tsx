import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');

export default function HostelDetailScreen() {
  const { id, edit: editParam } = useLocalSearchParams<{ id?: string; edit?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [hostel, setHostel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [imageLoading, setImageLoading] = useState<{ [key: string]: boolean }>({});
  const [coverImageLoading, setCoverImageLoading] = useState(true);
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const galleryShimmerAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const [activeSection, setActiveSection] = useState('basic');
  const [formData, setFormData] = useState<any>(null);
  const [highlightInput, setHighlightInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  const sections = [
    { id: 'basic', label: 'Basic Info', icon: 'information-circle' },
    { id: 'address', label: 'Address', icon: 'location' },
    { id: 'contact', label: 'Contact', icon: 'call' },
    { id: 'pricing', label: 'Pricing', icon: 'cash' },
    { id: 'amenities', label: 'Amenities', icon: 'star' },
    { id: 'facilities', label: 'Facilities', icon: 'build' },
    { id: 'rules', label: 'Rules', icon: 'document-text' },
    { id: 'business', label: 'Business', icon: 'business' },
    { id: 'images', label: 'Images', icon: 'images' },
  ];

  const addHighlight = () => {
    if (highlightInput.trim() && formData) {
      setFormData({
        ...formData,
        highlights: [...(formData.highlights || []), highlightInput.trim()],
      });
      setHighlightInput('');
    }
  };

  const removeHighlight = (index: number) => {
    if (formData) {
      setFormData({
        ...formData,
        highlights: (formData.highlights || []).filter((_: any, i: number) => i !== index),
      });
    }
  };

  const addTag = () => {
    if (tagInput.trim() && formData) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    if (formData) {
      setFormData({
        ...formData,
        tags: (formData.tags || []).filter((_: any, i: number) => i !== index),
      });
    }
  };

  useEffect(() => {
    if (id) {
      loadHostel();
    }
  }, [id]);

  // Initialize shimmer animations for gallery images - must be before early returns
  useEffect(() => {
    if (!hostel || !hostel.images) return;
    
    const images = Array.isArray(hostel.images) ? hostel.images.filter((img: string) => img && img.trim() !== '') : [];
    
    images.forEach((imageUrl: string) => {
      if (!galleryShimmerAnims[imageUrl]) {
        galleryShimmerAnims[imageUrl] = new Animated.Value(0);
      }
      if (imageLoading[imageUrl] !== false) {
        const anim = galleryShimmerAnims[imageUrl];
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    });
  }, [hostel?.images, imageLoading]);

  // Reset loading state when cover image changes - must be before early returns
  useEffect(() => {
    if (!hostel) return;
    
    const displayImage = hostel.coverImage || (Array.isArray(hostel.images) && hostel.images.length > 0 ? hostel.images[0] : null);
    
    if (displayImage) {
      setCoverImageLoading(true);
      // Start shimmer animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [hostel?.coverImage, hostel?.images]);

  const loadHostel = async () => {
    setLoading(true);
    try {
      const response = await api.getHostel(id as string);
      const data = (response as any)?.data ?? response;
      setHostel(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load hostel details');
    } finally {
      setLoading(false);
    }
  };

  // Open edit modal when navigated with edit=1 (e.g. from list "Edit" button)
  useEffect(() => {
    if (editParam === '1' && hostel && !loading) {
      populateFormFromHostel(hostel);
      setActiveSection('basic');
      setEditModalVisible(true);
    }
  }, [editParam, hostel, loading]);

  const handlePickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permissions to upload images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        await uploadImages(result.assets);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to pick images');
    }
  };

  const uploadImages = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setUploading(true);
    try {
      const formData = new FormData();
      assets.forEach((asset, index) => {
        const uri = asset.uri;
        const filename = uri.split('/').pop() || `image_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('images', {
          uri,
          name: filename,
          type,
        } as any);
      });

      await api.uploadHostelImages(id as string, formData);
      Alert.alert('Success', 'Images uploaded successfully');
      await loadHostel();
      setSelectedImageIndex(0);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageUrl: string) => {
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteHostelImage(id as string, imageUrl);
              Alert.alert('Success', 'Image deleted successfully');
              loadHostel();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete image');
            }
          },
        },
      ]
    );
  };

  const handleSetCover = async (imageUrl: string) => {
    try {
      await api.setCoverImage(id as string, imageUrl);
      Alert.alert('Success', 'Cover image updated');
      loadHostel();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to set cover image');
    }
  };

  const getMapUrl = () => {
    if (!hostel?.address?.coordinates) return null;
    const { latitude, longitude } = hostel.address.coordinates;
    const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey || 
                   process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
      // Fallback to static map if API key not available
      return `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=400x200&markers=color:red%7C${latitude},${longitude}`;
    }
    return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${latitude},${longitude}&zoom=15`;
  };

  const populateFormFromHostel = (hostelData: any) => {
    setFormData({
      name: hostelData.name || '',
      type: hostelData.type || 'boys',
      description: hostelData.description || '',
      shortDescription: hostelData.shortDescription || '',
      capacity: hostelData.capacity?.toString() || '',
      totalRooms: hostelData.totalRooms?.toString() || '',
      totalBlocks: hostelData.totalBlocks?.toString() || '',
      totalFloors: hostelData.totalFloors?.toString() || '',
      address: {
        street: hostelData.address?.street || '',
        city: hostelData.address?.city || '',
        state: hostelData.address?.state || '',
        pincode: hostelData.address?.pincode || '',
        country: hostelData.address?.country || 'India',
      },
      contact: {
        phone: hostelData.contact?.phone || '',
        email: hostelData.contact?.email || '',
        alternatePhone: hostelData.contact?.alternatePhone || '',
        managerName: hostelData.contact?.managerName || '',
        managerPhone: hostelData.contact?.managerPhone || '',
        managerEmail: hostelData.contact?.managerEmail || '',
        wardenName: hostelData.contact?.wardenName || '',
        wardenPhone: hostelData.contact?.wardenPhone || '',
        wardenEmail: hostelData.contact?.wardenEmail || '',
      },
      pricing: {
        minRent: hostelData.pricing?.minRent?.toString() || '',
        maxRent: hostelData.pricing?.maxRent?.toString() || '',
        securityDeposit: hostelData.pricing?.securityDeposit?.toString() || '',
        maintenanceCharges: hostelData.pricing?.maintenanceCharges?.toString() || '',
        electricityCharges: hostelData.pricing?.electricityCharges || 'separate',
        waterCharges: hostelData.pricing?.waterCharges || 'included',
        currency: hostelData.pricing?.currency || 'INR',
      },
      operatingHours: {
        officeHours: hostelData.operatingHours?.officeHours || '',
        checkInTime: hostelData.operatingHours?.checkInTime || '',
        checkOutTime: hostelData.operatingHours?.checkOutTime || '',
        maintenanceHours: hostelData.operatingHours?.maintenanceHours || '',
      },
      amenities: {
        wifi: hostelData.amenities?.wifi || false,
        wifiSpeed: hostelData.amenities?.wifiSpeed || '',
        wifiCost: hostelData.amenities?.wifiCost?.toString() || '',
        laundry: hostelData.amenities?.laundry || false,
        laundryType: hostelData.amenities?.laundryType || 'self-service',
        laundryCost: hostelData.amenities?.laundryCost?.toString() || '',
        mess: hostelData.amenities?.mess || false,
        messType: hostelData.amenities?.messType || 'both',
        messCost: hostelData.amenities?.messCost?.toString() || '',
        parking: hostelData.amenities?.parking || false,
        parkingType: hostelData.amenities?.parkingType || 'two-wheeler',
        parkingCost: hostelData.amenities?.parkingCost?.toString() || '',
        gym: hostelData.amenities?.gym || false,
        library: hostelData.amenities?.library || false,
        commonRoom: hostelData.amenities?.commonRoom || false,
        tvRoom: hostelData.amenities?.tvRoom || false,
        studyRoom: hostelData.amenities?.studyRoom || false,
      },
      facilities: {
        security: hostelData.facilities?.security || false,
        securityGuards: hostelData.facilities?.securityGuards?.toString() || '',
        cctv: hostelData.facilities?.cctv || false,
        cctvCount: hostelData.facilities?.cctvCount?.toString() || '',
        powerBackup: hostelData.facilities?.powerBackup || false,
        powerBackupHours: hostelData.facilities?.powerBackupHours?.toString() || '',
        waterSupply: hostelData.facilities?.waterSupply !== false,
        waterSupplyType: hostelData.facilities?.waterSupplyType || '24x7',
        medicalFacility: hostelData.facilities?.medicalFacility || false,
        sportsFacility: hostelData.facilities?.sportsFacility || false,
        fireSafety: hostelData.facilities?.fireSafety || false,
        lift: hostelData.facilities?.lift || false,
        generator: hostelData.facilities?.generator || false,
      },
      rules: {
        curfewTime: hostelData.rules?.curfewTime || '',
        weekendCurfewTime: hostelData.rules?.weekendCurfewTime || '',
        lateEntryAllowed: hostelData.rules?.lateEntryAllowed || false,
        lateEntryFine: hostelData.rules?.lateEntryFine?.toString() || '',
        visitorAllowed: hostelData.rules?.visitorAllowed !== false,
        visitorTimings: hostelData.rules?.visitorTimings || '',
        messTimings: {
          breakfast: hostelData.rules?.messTimings?.breakfast || '',
          lunch: hostelData.rules?.messTimings?.lunch || '',
          dinner: hostelData.rules?.messTimings?.dinner || '',
        },
        smokingAllowed: hostelData.rules?.smokingAllowed || false,
        alcoholAllowed: hostelData.rules?.alcoholAllowed || false,
        petsAllowed: hostelData.rules?.petsAllowed || false,
        oppositeGenderAllowed: hostelData.rules?.oppositeGenderAllowed || false,
      },
      businessInfo: {
        gstNumber: hostelData.businessInfo?.gstNumber || '',
        licenseNumber: hostelData.businessInfo?.licenseNumber || '',
        registrationNumber: hostelData.businessInfo?.registrationNumber || '',
        panNumber: hostelData.businessInfo?.panNumber || '',
        bankAccountNumber: hostelData.businessInfo?.bankAccountNumber || '',
        bankName: hostelData.businessInfo?.bankName || '',
        ifscCode: hostelData.businessInfo?.ifscCode || '',
        accountHolderName: hostelData.businessInfo?.accountHolderName || '',
      },
      highlights: hostelData.highlights || [],
      tags: hostelData.tags || [],
      status: hostelData.status || 'active',
    });
  };

  const handleEdit = () => {
    if (hostel) {
      populateFormFromHostel(hostel);
      setActiveSection('basic');
      setEditModalVisible(true);
    }
  };

  const handleUpdate = async () => {
    if (!formData?.name || !formData?.capacity) {
      Alert.alert('Error', 'Please fill in all required fields (Name, Capacity)');
      return;
    }

    try {
      const submitData: any = {
        ...formData,
        capacity: parseInt(formData.capacity) || 0,
        totalRooms: parseInt(formData.totalRooms) || 0,
        totalBlocks: parseInt(formData.totalBlocks) || 0,
        totalFloors: parseInt(formData.totalFloors) || 0,
        pricing: {
          ...formData.pricing,
          minRent: parseFloat(formData.pricing.minRent) || 0,
          maxRent: parseFloat(formData.pricing.maxRent) || 0,
          securityDeposit: parseFloat(formData.pricing.securityDeposit) || 0,
          maintenanceCharges: parseFloat(formData.pricing.maintenanceCharges) || 0,
        },
        facilities: {
          ...formData.facilities,
          securityGuards: parseInt(formData.facilities.securityGuards) || 0,
          cctvCount: parseInt(formData.facilities.cctvCount) || 0,
          powerBackupHours: parseInt(formData.facilities.powerBackupHours) || 0,
        },
        amenities: {
          ...formData.amenities,
          wifiCost: parseFloat(formData.amenities.wifiCost) || 0,
          laundryCost: parseFloat(formData.amenities.laundryCost) || 0,
          messCost: parseFloat(formData.amenities.messCost) || 0,
          parkingCost: parseFloat(formData.amenities.parkingCost) || 0,
        },
        rules: {
          ...formData.rules,
          lateEntryFine: parseFloat(formData.rules.lateEntryFine) || 0,
        },
      };
      if (submitData.address) {
        const coords = submitData.address.coordinates;
        if (coords === undefined || coords === null || typeof coords?.latitude !== 'number' || typeof coords?.longitude !== 'number') {
          const { coordinates: _c, ...restAddress } = submitData.address;
          submitData.address = restAddress;
        }
      }

      await api.updateHostel(id as string, submitData);
      Alert.alert('Success', 'Hostel updated successfully');
      setEditModalVisible(false);
      loadHostel();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update hostel');
    }
  };

  const renderEditSection = () => {
    if (!formData) return null;

    switch (activeSection) {
      case 'basic':
        return (
          <View>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            <TextInput
              style={styles.input}
              placeholder="Hostel Name *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.typeButton, formData.type === 'boys' && styles.typeButtonActive]}
                onPress={() => setFormData({ ...formData, type: 'boys' })}
              >
                <Text style={[styles.typeButtonText, formData.type === 'boys' && styles.typeButtonTextActive]}>
                  Boys
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, formData.type === 'girls' && styles.typeButtonActive]}
                onPress={() => setFormData({ ...formData, type: 'girls' })}
              >
                <Text style={[styles.typeButtonText, formData.type === 'girls' && styles.typeButtonTextActive]}>
                  Girls
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, formData.type === 'co-ed' && styles.typeButtonActive]}
                onPress={() => setFormData({ ...formData, type: 'co-ed' })}
              >
                <Text style={[styles.typeButtonText, formData.type === 'co-ed' && styles.typeButtonTextActive]}>
                  Co-ed
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Short Description"
              value={formData.shortDescription}
              onChangeText={(text) => setFormData({ ...formData, shortDescription: text })}
              multiline
              numberOfLines={2}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Full Description"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={4}
            />
            <TextInput
              style={styles.input}
              placeholder="Total Capacity *"
              value={formData.capacity}
              onChangeText={(text) => setFormData({ ...formData, capacity: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Total Rooms"
              value={formData.totalRooms}
              onChangeText={(text) => setFormData({ ...formData, totalRooms: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Total Blocks"
              value={formData.totalBlocks}
              onChangeText={(text) => setFormData({ ...formData, totalBlocks: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Total Floors"
              value={formData.totalFloors}
              onChangeText={(text) => setFormData({ ...formData, totalFloors: text })}
              keyboardType="numeric"
            />
            <View style={styles.tagContainer}>
              <Text style={styles.label}>Highlights</Text>
              <View style={styles.tagInputRow}>
                <TextInput
                  style={[styles.input, styles.tagInput]}
                  placeholder="Add highlight"
                  value={highlightInput}
                  onChangeText={setHighlightInput}
                  onSubmitEditing={addHighlight}
                />
                <TouchableOpacity style={styles.addTagButton} onPress={addHighlight}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.tagsContainer}>
                {(formData.highlights || []).map((highlight: string, index: number) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{highlight}</Text>
                    <TouchableOpacity onPress={() => removeHighlight(index)}>
                      <Ionicons name="close-circle" size={18} color="#999" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.tagContainer}>
              <Text style={styles.label}>Tags</Text>
              <View style={styles.tagInputRow}>
                <TextInput
                  style={[styles.input, styles.tagInput]}
                  placeholder="Add tag"
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={addTag}
                />
                <TouchableOpacity style={styles.addTagButton} onPress={addTag}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.tagsContainer}>
                {(formData.tags || []).map((tag: string, index: number) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                    <TouchableOpacity onPress={() => removeTag(index)}>
                      <Ionicons name="close-circle" size={18} color="#999" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          </View>
        );

      case 'address':
        return (
          <View>
            <Text style={styles.sectionTitle}>Address Information</Text>
            <TextInput
              style={styles.input}
              placeholder="Street Address"
              value={formData.address?.street || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, street: text },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="City"
              value={formData.address?.city || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, city: text },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="State"
              value={formData.address?.state || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, state: text },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Pincode"
              value={formData.address?.pincode || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, pincode: text },
                })
              }
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Country"
              value={formData.address?.country || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, country: text },
                })
              }
            />
          </View>
        );

      case 'contact':
        return (
          <View>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <TextInput
              style={styles.input}
              placeholder="Primary Phone *"
              value={formData.contact?.phone || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  contact: { ...formData.contact, phone: text },
                })
              }
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Email *"
              value={formData.contact?.email || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  contact: { ...formData.contact, email: text },
                })
              }
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Alternate Phone"
              value={formData.contact?.alternatePhone || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  contact: { ...formData.contact, alternatePhone: text },
                })
              }
              keyboardType="phone-pad"
            />
            <Text style={styles.subsectionTitle}>Manager Details</Text>
            <TextInput
              style={styles.input}
              placeholder="Manager Name"
              value={formData.contact?.managerName || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  contact: { ...formData.contact, managerName: text },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Manager Phone"
              value={formData.contact?.managerPhone || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  contact: { ...formData.contact, managerPhone: text },
                })
              }
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Manager Email"
              value={formData.contact?.managerEmail || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  contact: { ...formData.contact, managerEmail: text },
                })
              }
              keyboardType="email-address"
            />
            <Text style={styles.subsectionTitle}>Warden Details</Text>
            <TextInput
              style={styles.input}
              placeholder="Warden Name"
              value={formData.contact?.wardenName || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  contact: { ...formData.contact, wardenName: text },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Warden Phone"
              value={formData.contact?.wardenPhone || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  contact: { ...formData.contact, wardenPhone: text },
                })
              }
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Warden Email"
              value={formData.contact?.wardenEmail || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  contact: { ...formData.contact, wardenEmail: text },
                })
              }
              keyboardType="email-address"
            />
          </View>
        );

      case 'pricing':
        return (
          <View>
            <Text style={styles.sectionTitle}>Pricing Information</Text>
            <TextInput
              style={styles.input}
              placeholder="Minimum Rent (₹)"
              value={formData.pricing?.minRent || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  pricing: { ...formData.pricing, minRent: text },
                })
              }
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Maximum Rent (₹)"
              value={formData.pricing?.maxRent || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  pricing: { ...formData.pricing, maxRent: text },
                })
              }
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Security Deposit (₹)"
              value={formData.pricing?.securityDeposit || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  pricing: { ...formData.pricing, securityDeposit: text },
                })
              }
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Maintenance Charges (₹/month)"
              value={formData.pricing?.maintenanceCharges || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  pricing: { ...formData.pricing, maintenanceCharges: text },
                })
              }
              keyboardType="numeric"
            />
            <Text style={styles.label}>Electricity Charges</Text>
            <View style={styles.row}>
              {['included', 'separate', 'metered'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    formData.pricing?.electricityCharges === option && styles.optionButtonActive,
                  ]}
                  onPress={() =>
                    setFormData({
                      ...formData,
                      pricing: { ...formData.pricing, electricityCharges: option },
                    })
                  }
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      formData.pricing?.electricityCharges === option && styles.optionButtonTextActive,
                    ]}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Water Charges</Text>
            <View style={styles.row}>
              {['included', 'separate'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    formData.pricing?.waterCharges === option && styles.optionButtonActive,
                  ]}
                  onPress={() =>
                    setFormData({
                      ...formData,
                      pricing: { ...formData.pricing, waterCharges: option },
                    })
                  }
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      formData.pricing?.waterCharges === option && styles.optionButtonTextActive,
                    ]}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Operating Hours</Text>
            <TextInput
              style={styles.input}
              placeholder="Office Hours (e.g., 9:00 AM - 6:00 PM)"
              value={formData.operatingHours?.officeHours || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  operatingHours: { ...formData.operatingHours, officeHours: text },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Check-in Time (e.g., 10:00 AM)"
              value={formData.operatingHours?.checkInTime || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  operatingHours: { ...formData.operatingHours, checkInTime: text },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Check-out Time (e.g., 11:00 AM)"
              value={formData.operatingHours?.checkOutTime || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  operatingHours: { ...formData.operatingHours, checkOutTime: text },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Maintenance Hours (e.g., 8:00 AM - 5:00 PM)"
              value={formData.operatingHours?.maintenanceHours || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  operatingHours: { ...formData.operatingHours, maintenanceHours: text },
                })
              }
            />
          </View>
        );

      case 'amenities':
        return (
          <View>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>WiFi</Text>
              <Switch
                value={formData.amenities?.wifi || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    amenities: { ...formData.amenities, wifi: value },
                  })
                }
              />
            </View>
            {formData.amenities?.wifi && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="WiFi Speed (e.g., 100 Mbps)"
                  value={formData.amenities?.wifiSpeed || ''}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      amenities: { ...formData.amenities, wifiSpeed: text },
                    })
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="WiFi Cost (₹/month)"
                  value={formData.amenities?.wifiCost || ''}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      amenities: { ...formData.amenities, wifiCost: text },
                    })
                  }
                  keyboardType="numeric"
                />
              </>
            )}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Laundry</Text>
              <Switch
                value={formData.amenities?.laundry || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    amenities: { ...formData.amenities, laundry: value },
                  })
                }
              />
            </View>
            {formData.amenities?.laundry && (
              <>
                <Text style={styles.label}>Laundry Type</Text>
                <View style={styles.row}>
                  {['self-service', 'service', 'both'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.optionButton,
                        formData.amenities?.laundryType === option && styles.optionButtonActive,
                      ]}
                      onPress={() =>
                        setFormData({
                          ...formData,
                          amenities: { ...formData.amenities, laundryType: option },
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          formData.amenities?.laundryType === option && styles.optionButtonTextActive,
                        ]}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Laundry Cost (₹)"
                  value={formData.amenities?.laundryCost || ''}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      amenities: { ...formData.amenities, laundryCost: text },
                    })
                  }
                  keyboardType="numeric"
                />
              </>
            )}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Mess</Text>
              <Switch
                value={formData.amenities?.mess || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    amenities: { ...formData.amenities, mess: value },
                  })
                }
              />
            </View>
            {formData.amenities?.mess && (
              <>
                <Text style={styles.label}>Mess Type</Text>
                <View style={styles.row}>
                  {['vegetarian', 'non-vegetarian', 'both'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.optionButton,
                        formData.amenities?.messType === option && styles.optionButtonActive,
                      ]}
                      onPress={() =>
                        setFormData({
                          ...formData,
                          amenities: { ...formData.amenities, messType: option },
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          formData.amenities?.messType === option && styles.optionButtonTextActive,
                        ]}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Mess Cost (₹/month)"
                  value={formData.amenities?.messCost || ''}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      amenities: { ...formData.amenities, messCost: text },
                    })
                  }
                  keyboardType="numeric"
                />
              </>
            )}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Parking</Text>
              <Switch
                value={formData.amenities?.parking || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    amenities: { ...formData.amenities, parking: value },
                  })
                }
              />
            </View>
            {formData.amenities?.parking && (
              <>
                <Text style={styles.label}>Parking Type</Text>
                <View style={styles.row}>
                  {['two-wheeler', 'four-wheeler', 'both'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.optionButton,
                        formData.amenities?.parkingType === option && styles.optionButtonActive,
                      ]}
                      onPress={() =>
                        setFormData({
                          ...formData,
                          amenities: { ...formData.amenities, parkingType: option },
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          formData.amenities?.parkingType === option && styles.optionButtonTextActive,
                        ]}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Parking Cost (₹/month)"
                  value={formData.amenities?.parkingCost || ''}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      amenities: { ...formData.amenities, parkingCost: text },
                    })
                  }
                  keyboardType="numeric"
                />
              </>
            )}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Gym</Text>
              <Switch
                value={formData.amenities?.gym || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    amenities: { ...formData.amenities, gym: value },
                  })
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Library</Text>
              <Switch
                value={formData.amenities?.library || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    amenities: { ...formData.amenities, library: value },
                  })
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Common Room</Text>
              <Switch
                value={formData.amenities?.commonRoom || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    amenities: { ...formData.amenities, commonRoom: value },
                  })
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>TV Room</Text>
              <Switch
                value={formData.amenities?.tvRoom || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    amenities: { ...formData.amenities, tvRoom: value },
                  })
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Study Room</Text>
              <Switch
                value={formData.amenities?.studyRoom || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    amenities: { ...formData.amenities, studyRoom: value },
                  })
                }
              />
            </View>
          </View>
        );

      case 'facilities':
        return (
          <View>
            <Text style={styles.sectionTitle}>Facilities</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Security</Text>
              <Switch
                value={formData.facilities?.security || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    facilities: { ...formData.facilities, security: value },
                  })
                }
              />
            </View>
            {formData.facilities?.security && (
              <TextInput
                style={styles.input}
                placeholder="Number of Security Guards"
                value={formData.facilities?.securityGuards || ''}
                onChangeText={(text) =>
                  setFormData({
                    ...formData,
                    facilities: { ...formData.facilities, securityGuards: text },
                  })
                }
                keyboardType="numeric"
              />
            )}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>CCTV</Text>
              <Switch
                value={formData.facilities?.cctv || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    facilities: { ...formData.facilities, cctv: value },
                  })
                }
              />
            </View>
            {formData.facilities?.cctv && (
              <TextInput
                style={styles.input}
                placeholder="Number of CCTV Cameras"
                value={formData.facilities?.cctvCount || ''}
                onChangeText={(text) =>
                  setFormData({
                    ...formData,
                    facilities: { ...formData.facilities, cctvCount: text },
                  })
                }
                keyboardType="numeric"
              />
            )}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Power Backup</Text>
              <Switch
                value={formData.facilities?.powerBackup || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    facilities: { ...formData.facilities, powerBackup: value },
                  })
                }
              />
            </View>
            {formData.facilities?.powerBackup && (
              <TextInput
                style={styles.input}
                placeholder="Power Backup Hours"
                value={formData.facilities?.powerBackupHours || ''}
                onChangeText={(text) =>
                  setFormData({
                    ...formData,
                    facilities: { ...formData.facilities, powerBackupHours: text },
                  })
                }
                keyboardType="numeric"
              />
            )}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>24x7 Water Supply</Text>
              <Switch
                value={formData.facilities?.waterSupply !== false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    facilities: { ...formData.facilities, waterSupply: value },
                  })
                }
              />
            </View>
            {formData.facilities?.waterSupply && (
              <>
                <Text style={styles.label}>Water Supply Type</Text>
                <View style={styles.row}>
                  {['24x7', 'scheduled', 'limited'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.optionButton,
                        formData.facilities?.waterSupplyType === option && styles.optionButtonActive,
                      ]}
                      onPress={() =>
                        setFormData({
                          ...formData,
                          facilities: { ...formData.facilities, waterSupplyType: option },
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          formData.facilities?.waterSupplyType === option && styles.optionButtonTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Medical Facility</Text>
              <Switch
                value={formData.facilities?.medicalFacility || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    facilities: { ...formData.facilities, medicalFacility: value },
                  })
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Sports Facility</Text>
              <Switch
                value={formData.facilities?.sportsFacility || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    facilities: { ...formData.facilities, sportsFacility: value },
                  })
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Fire Safety</Text>
              <Switch
                value={formData.facilities?.fireSafety || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    facilities: { ...formData.facilities, fireSafety: value },
                  })
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Lift</Text>
              <Switch
                value={formData.facilities?.lift || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    facilities: { ...formData.facilities, lift: value },
                  })
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Generator</Text>
              <Switch
                value={formData.facilities?.generator || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    facilities: { ...formData.facilities, generator: value },
                  })
                }
              />
            </View>
          </View>
        );

      case 'rules':
        return (
          <View>
            <Text style={styles.sectionTitle}>Rules & Policies</Text>
            <TextInput
              style={styles.input}
              placeholder="Curfew Time (e.g., 10:00 PM)"
              value={formData.rules?.curfewTime || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  rules: { ...formData.rules, curfewTime: text },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Weekend Curfew Time (e.g., 11:00 PM)"
              value={formData.rules?.weekendCurfewTime || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  rules: { ...formData.rules, weekendCurfewTime: text },
                })
              }
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Late Entry Allowed</Text>
              <Switch
                value={formData.rules?.lateEntryAllowed || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    rules: { ...formData.rules, lateEntryAllowed: value },
                  })
                }
              />
            </View>
            {formData.rules?.lateEntryAllowed && (
              <TextInput
                style={styles.input}
                placeholder="Late Entry Fine (₹)"
                value={formData.rules?.lateEntryFine || ''}
                onChangeText={(text) =>
                  setFormData({
                    ...formData,
                    rules: { ...formData.rules, lateEntryFine: text },
                  })
                }
                keyboardType="numeric"
              />
            )}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Visitors Allowed</Text>
              <Switch
                value={formData.rules?.visitorAllowed !== false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    rules: { ...formData.rules, visitorAllowed: value },
                  })
                }
              />
            </View>
            {formData.rules?.visitorAllowed && (
              <TextInput
                style={styles.input}
                placeholder="Visitor Timings (e.g., 10:00 AM - 8:00 PM)"
                value={formData.rules?.visitorTimings || ''}
                onChangeText={(text) =>
                  setFormData({
                    ...formData,
                    rules: { ...formData.rules, visitorTimings: text },
                  })
                }
              />
            )}
            <Text style={styles.subsectionTitle}>Mess Timings</Text>
            <TextInput
              style={styles.input}
              placeholder="Breakfast (e.g., 7:00 AM - 9:00 AM)"
              value={formData.rules?.messTimings?.breakfast || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  rules: {
                    ...formData.rules,
                    messTimings: { ...formData.rules.messTimings, breakfast: text },
                  },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Lunch (e.g., 12:00 PM - 2:00 PM)"
              value={formData.rules?.messTimings?.lunch || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  rules: {
                    ...formData.rules,
                    messTimings: { ...formData.rules.messTimings, lunch: text },
                  },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Dinner (e.g., 7:00 PM - 9:00 PM)"
              value={formData.rules?.messTimings?.dinner || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  rules: {
                    ...formData.rules,
                    messTimings: { ...formData.rules.messTimings, dinner: text },
                  },
                })
              }
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Smoking Allowed</Text>
              <Switch
                value={formData.rules?.smokingAllowed || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    rules: { ...formData.rules, smokingAllowed: value },
                  })
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Alcohol Allowed</Text>
              <Switch
                value={formData.rules?.alcoholAllowed || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    rules: { ...formData.rules, alcoholAllowed: value },
                  })
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Pets Allowed</Text>
              <Switch
                value={formData.rules?.petsAllowed || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    rules: { ...formData.rules, petsAllowed: value },
                  })
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Opposite Gender Allowed</Text>
              <Switch
                value={formData.rules?.oppositeGenderAllowed || false}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    rules: { ...formData.rules, oppositeGenderAllowed: value },
                  })
                }
              />
            </View>
          </View>
        );

      case 'business':
        return (
          <View>
            <Text style={styles.sectionTitle}>Business Information</Text>
            <TextInput
              style={styles.input}
              placeholder="GST Number"
              value={formData.businessInfo?.gstNumber || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  businessInfo: { ...formData.businessInfo, gstNumber: text },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="License Number"
              value={formData.businessInfo?.licenseNumber || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  businessInfo: { ...formData.businessInfo, licenseNumber: text },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Registration Number"
              value={formData.businessInfo?.registrationNumber || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  businessInfo: { ...formData.businessInfo, registrationNumber: text },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="PAN Number"
              value={formData.businessInfo?.panNumber || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  businessInfo: { ...formData.businessInfo, panNumber: text },
                })
              }
            />
            <Text style={styles.subsectionTitle}>Bank Details</Text>
            <TextInput
              style={styles.input}
              placeholder="Account Number"
              value={formData.businessInfo?.bankAccountNumber || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  businessInfo: { ...formData.businessInfo, bankAccountNumber: text },
                })
              }
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Bank Name"
              value={formData.businessInfo?.bankName || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  businessInfo: { ...formData.businessInfo, bankName: text },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="IFSC Code"
              value={formData.businessInfo?.ifscCode || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  businessInfo: { ...formData.businessInfo, ifscCode: text.toUpperCase() },
                })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Account Holder Name"
              value={formData.businessInfo?.accountHolderName || ''}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  businessInfo: { ...formData.businessInfo, accountHolderName: text },
                })
              }
            />
          </View>
        );

      case 'images':
        return (
          <View>
            <Text style={styles.sectionTitle}>Hostel Images</Text>
            <Text style={styles.label}>Upload images to display on the hostel detail page</Text>
            <TouchableOpacity
              style={styles.uploadImageButton}
              onPress={handlePickImages}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={20} color="#fff" />
                  <Text style={styles.uploadImageButtonText}>Upload Images</Text>
                </>
              )}
            </TouchableOpacity>
            {images && images.length > 0 ? (
              <View style={styles.imagePreviewContainer}>
                <Text style={styles.label}>Current Images ({images.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {images.map((imageUrl: string, index: number) => (
                    <View key={index} style={styles.imagePreviewItem}>
                      <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
                      <View style={styles.imagePreviewActions}>
                        {hostel.coverImage !== imageUrl && (
                          <TouchableOpacity
                            style={styles.imagePreviewAction}
                            onPress={() => handleSetCover(imageUrl)}
                          >
                            <Ionicons name="star-outline" size={16} color="#fff" />
                          </TouchableOpacity>
                        )}
                        {hostel.coverImage === imageUrl && (
                          <View style={styles.coverBadge}>
                            <Ionicons name="star" size={16} color="#FFD700" />
                            <Text style={styles.coverBadgeText}>Cover</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.imagePreviewAction}
                          onPress={() => handleDeleteImage(imageUrl)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  if (!hostel) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Hostel not found</Text>
      </View>
    );
  }

  const images = Array.isArray(hostel.images) ? hostel.images.filter((img: string) => img && img.trim() !== '') : [];
  const displayImage = hostel.coverImage || (images.length > 0 ? images[selectedImageIndex] || images[0] : null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
      {/* Cover Image */}
      {displayImage ? (
        <View style={styles.imageContainer}>
          {coverImageLoading && (
            <View style={styles.imageLoadingContainer}>
              <ActivityIndicator size="large" color="#0a7ea4" />
              <Animated.View
                style={[
                  styles.shimmerOverlay,
                  {
                    opacity: shimmerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.7],
                    }),
                  },
                ]}
              />
            </View>
          )}
          <Image 
            source={{ uri: displayImage }} 
            style={[styles.coverImage, coverImageLoading && styles.imageHidden]}
            resizeMode="cover"
            onError={() => {
              setCoverImageLoading(false);
            }}
            onLoadStart={() => {
              setCoverImageLoading(true);
            }}
            onLoad={() => {
              setCoverImageLoading(false);
            }}
          />
          {images && images.length > 1 ? (
            <View style={styles.imageIndicators}>
              {images.map((_: any, index: number) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.indicator,
                    selectedImageIndex === index && styles.indicatorActive,
                  ]}
                  onPress={() => setSelectedImageIndex(index)}
                />
              ))}
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handlePickImages}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="camera" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.noImageContainer} onPress={handlePickImages}>
          <Ionicons name="image-outline" size={60} color="#999" />
          <Text style={styles.noImageText}>Tap to add images</Text>
        </TouchableOpacity>
      )}

      {hostel ? (
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{hostel.name || 'Unnamed Hostel'}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{(hostel.type || 'boys').toUpperCase()}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.editButtonText}>Edit Hostel</Text>
            </TouchableOpacity>
          </View>

        {hostel.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{hostel.description}</Text>
          </View>
        ) : null}

        {/* Address */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="location" size={18} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>Address</Text>
          </View>
          <Text style={styles.address}>
            {hostel.address?.formattedAddress ||
              `${hostel.address?.street || ''}, ${hostel.address?.city || ''}, ${
                hostel.address?.state || ''
              } ${hostel.address?.pincode || ''}`}
          </Text>
        </View>

        {/* Map */}
        {hostel.address?.coordinates && getMapUrl() && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="map" size={18} color="#0a7ea4" />
              <Text style={styles.sectionTitle}>Location</Text>
            </View>
            <View style={styles.mapContainer}>
              <WebView
                source={{ uri: getMapUrl() || '' }}
                style={styles.map}
                javaScriptEnabled={true}
                domStorageEnabled={true}
              />
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color="#0a7ea4" />
            <Text style={styles.statValue}>{hostel.capacity || 0}</Text>
            <Text style={styles.statLabel}>Capacity</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="person" size={24} color="#4CAF50" />
            <Text style={styles.statValue}>{hostel.currentOccupancy || 0}</Text>
            <Text style={styles.statLabel}>Occupied</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="bed" size={24} color="#FF9800" />
            <Text style={styles.statValue}>
              {(hostel.capacity || 0) - (hostel.currentOccupancy || 0)}
            </Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
        </View>

        {/* Additional Stats */}
        {(hostel.totalRooms || hostel.totalBlocks || hostel.totalFloors) && (
          <View style={styles.statsContainer}>
            {hostel.totalRooms > 0 && (
              <View style={styles.statCard}>
                <Ionicons name="home" size={24} color="#9C27B0" />
                <Text style={styles.statValue}>{hostel.totalRooms}</Text>
                <Text style={styles.statLabel}>Total Rooms</Text>
              </View>
            )}
            {hostel.totalBlocks > 0 && (
              <View style={styles.statCard}>
                <Ionicons name="business" size={24} color="#E91E63" />
                <Text style={styles.statValue}>{hostel.totalBlocks}</Text>
                <Text style={styles.statLabel}>Blocks</Text>
              </View>
            )}
            {hostel.totalFloors > 0 && (
              <View style={styles.statCard}>
                <Ionicons name="layers" size={24} color="#00BCD4" />
                <Text style={styles.statValue}>{hostel.totalFloors}</Text>
                <Text style={styles.statLabel}>Floors</Text>
              </View>
            )}
          </View>
        )}

        {/* Short Description */}
        {hostel.shortDescription ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Overview</Text>
            <Text style={styles.description}>{hostel.shortDescription}</Text>
          </View>
        ) : null}

        {/* Highlights */}
        {hostel.highlights && hostel.highlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Highlights</Text>
            {hostel.highlights.map((highlight: string, index: number) => (
              <View key={index} style={styles.highlightItem}>
                <Ionicons name="star" size={16} color="#FFC107" />
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tags */}
        {hostel.tags && hostel.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagsContainer}>
              {hostel.tags.map((tag: string, index: number) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Amenities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amenities</Text>
          <View style={styles.amenitiesGrid}>
            {hostel.amenities?.wifi && (
              <View style={styles.amenityItem}>
                <Ionicons name="wifi" size={20} color="#0a7ea4" />
                <Text style={styles.amenityText}>WiFi</Text>
              </View>
            )}
            {hostel.amenities?.laundry && (
              <View style={styles.amenityItem}>
                <Ionicons name="shirt" size={20} color="#0a7ea4" />
                <Text style={styles.amenityText}>Laundry</Text>
              </View>
            )}
            {hostel.amenities?.mess && (
              <View style={styles.amenityItem}>
                <Ionicons name="restaurant" size={20} color="#0a7ea4" />
                <Text style={styles.amenityText}>Mess</Text>
              </View>
            )}
            {hostel.amenities?.parking && (
              <View style={styles.amenityItem}>
                <Ionicons name="car" size={20} color="#0a7ea4" />
                <Text style={styles.amenityText}>Parking</Text>
              </View>
            )}
            {hostel.amenities?.gym && (
              <View style={styles.amenityItem}>
                <Ionicons name="barbell" size={20} color="#0a7ea4" />
                <Text style={styles.amenityText}>Gym</Text>
              </View>
            )}
            {hostel.amenities?.library && (
              <View style={styles.amenityItem}>
                <Ionicons name="library" size={20} color="#0a7ea4" />
                <Text style={styles.amenityText}>Library</Text>
              </View>
            )}
            {hostel.amenities?.others?.map((amenity: string, index: number) => (
              <View key={index} style={styles.amenityItem}>
                <Ionicons name="checkmark-circle" size={20} color="#0a7ea4" />
                <Text style={styles.amenityText}>{amenity}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Facilities */}
        {hostel.facilities && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Facilities</Text>
            <View style={styles.facilitiesList}>
              {hostel.facilities.security && (
                <View style={styles.facilityItem}>
                  <Ionicons name="shield-checkmark" size={18} color="#4CAF50" />
                  <Text style={styles.facilityText}>24/7 Security</Text>
                </View>
              )}
              {hostel.facilities.cctv && (
                <View style={styles.facilityItem}>
                  <Ionicons name="videocam" size={18} color="#4CAF50" />
                  <Text style={styles.facilityText}>CCTV</Text>
                </View>
              )}
              {hostel.facilities.powerBackup && (
                <View style={styles.facilityItem}>
                  <Ionicons name="flash" size={18} color="#4CAF50" />
                  <Text style={styles.facilityText}>Power Backup</Text>
                </View>
              )}
              {hostel.facilities.medicalFacility && (
                <View style={styles.facilityItem}>
                  <Ionicons name="medical" size={18} color="#4CAF50" />
                  <Text style={styles.facilityText}>Medical Facility</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Nearby Places */}
        {hostel.nearbyPlaces && hostel.nearbyPlaces.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nearby Places</Text>
            {hostel.nearbyPlaces.map((place: any, index: number) => (
              <View key={index} style={styles.nearbyPlace}>
                <Ionicons name="location" size={18} color="#FF9800" />
                <View style={styles.nearbyPlaceInfo}>
                  <Text style={styles.nearbyPlaceName}>{place.name}</Text>
                  <Text style={styles.nearbyPlaceDistance}>{place.distance}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Images Gallery */}
        {images && images.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="images" size={18} color="#0a7ea4" />
              <Text style={styles.sectionTitle}>Gallery ({images.length} images)</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {images.map((imageUrl: string, index: number) => {
                const isLoading = imageLoading[imageUrl] !== false;
                return (
                  <View key={index} style={styles.galleryItem}>
                    {isLoading && (
                      <View style={styles.galleryImageLoadingContainer}>
                        <ActivityIndicator size="small" color="#0a7ea4" />
                        <Animated.View
                          style={[
                            styles.shimmerOverlay,
                            {
                              width: 120,
                              transform: [
                                {
                                  translateX: (galleryShimmerAnims[imageUrl] || new Animated.Value(0)).interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-120, 120],
                                  }),
                                },
                              ],
                              opacity: (galleryShimmerAnims[imageUrl] || new Animated.Value(0)).interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [0, 0.3, 0],
                              }),
                            },
                          ]}
                        />
                      </View>
                    )}
                    <Image 
                      source={{ uri: imageUrl }} 
                      style={[styles.galleryImage, isLoading && styles.imageHidden]}
                      resizeMode="cover"
                    onError={() => {
                      setImageLoading((prev) => ({ ...prev, [imageUrl]: false }));
                    }}
                    onLoadStart={() => {
                      setImageLoading((prev) => ({ ...prev, [imageUrl]: true }));
                    }}
                    onLoad={() => {
                      setImageLoading((prev) => ({ ...prev, [imageUrl]: false }));
                    }}
                    />
                  <View style={styles.galleryActions}>
                    {hostel.coverImage !== imageUrl && (
                      <TouchableOpacity
                        style={styles.galleryAction}
                        onPress={() => handleSetCover(imageUrl)}
                      >
                        <Ionicons name="star-outline" size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                    {hostel.coverImage === imageUrl && (
                      <View style={styles.coverBadge}>
                        <Ionicons name="star" size={16} color="#FFD700" />
                        <Text style={styles.coverBadgeText}>Cover</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.galleryAction}
                      onPress={() => handleDeleteImage(imageUrl)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Contact */}
        {hostel.contact && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            {hostel.contact.phone && (
              <View style={styles.contactItem}>
                <Ionicons name="call" size={18} color="#0a7ea4" />
                <Text style={styles.contactText}>{hostel.contact.phone}</Text>
              </View>
            )}
            {hostel.contact.email && (
              <View style={styles.contactItem}>
                <Ionicons name="mail" size={18} color="#0a7ea4" />
                <Text style={styles.contactText}>{hostel.contact.email}</Text>
              </View>
            )}
            {hostel.contact.alternatePhone && (
              <View style={styles.contactItem}>
                <Ionicons name="call-outline" size={18} color="#0a7ea4" />
                <Text style={styles.contactText}>{hostel.contact.alternatePhone}</Text>
              </View>
            )}
            {(hostel.contact.managerName || hostel.contact.managerPhone) && (
              <>
                <Text style={styles.subsectionTitle}>Manager</Text>
                {hostel.contact.managerName && (
                  <View style={styles.contactItem}>
                    <Ionicons name="person" size={18} color="#0a7ea4" />
                    <Text style={styles.contactText}>{hostel.contact.managerName}</Text>
                  </View>
                )}
                {hostel.contact.managerPhone && (
                  <View style={styles.contactItem}>
                    <Ionicons name="call" size={18} color="#0a7ea4" />
                    <Text style={styles.contactText}>{hostel.contact.managerPhone}</Text>
                  </View>
                )}
                {hostel.contact.managerEmail && (
                  <View style={styles.contactItem}>
                    <Ionicons name="mail" size={18} color="#0a7ea4" />
                    <Text style={styles.contactText}>{hostel.contact.managerEmail}</Text>
                  </View>
                )}
              </>
            )}
            {(hostel.contact.wardenName || hostel.contact.wardenPhone) && (
              <>
                <Text style={styles.subsectionTitle}>Warden</Text>
                {hostel.contact.wardenName && (
                  <View style={styles.contactItem}>
                    <Ionicons name="person" size={18} color="#0a7ea4" />
                    <Text style={styles.contactText}>{hostel.contact.wardenName}</Text>
                  </View>
                )}
                {hostel.contact.wardenPhone && (
                  <View style={styles.contactItem}>
                    <Ionicons name="call" size={18} color="#0a7ea4" />
                    <Text style={styles.contactText}>{hostel.contact.wardenPhone}</Text>
                  </View>
                )}
                {hostel.contact.wardenEmail && (
                  <View style={styles.contactItem}>
                    <Ionicons name="mail" size={18} color="#0a7ea4" />
                    <Text style={styles.contactText}>{hostel.contact.wardenEmail}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Pricing */}
        {hostel.pricing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing Information</Text>
            {((hostel.pricing.minRent !== undefined && hostel.pricing.minRent !== null) || 
              (hostel.pricing.maxRent !== undefined && hostel.pricing.maxRent !== null)) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Rent Range:</Text>
                <Text style={styles.infoValue}>
                  ₹{hostel.pricing.minRent || 0} - ₹{hostel.pricing.maxRent || 0}/month
                </Text>
              </View>
            )}
            {(hostel.pricing.securityDeposit !== undefined && hostel.pricing.securityDeposit !== null && hostel.pricing.securityDeposit > 0) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Security Deposit:</Text>
                <Text style={styles.infoValue}>₹{hostel.pricing.securityDeposit}</Text>
              </View>
            )}
            {(hostel.pricing.maintenanceCharges !== undefined && hostel.pricing.maintenanceCharges !== null && hostel.pricing.maintenanceCharges > 0) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Maintenance:</Text>
                <Text style={styles.infoValue}>₹{hostel.pricing.maintenanceCharges}/month</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Electricity:</Text>
              <Text style={styles.infoValue}>
                {hostel.pricing.electricityCharges 
                  ? hostel.pricing.electricityCharges.charAt(0).toUpperCase() + hostel.pricing.electricityCharges.slice(1)
                  : 'Separate'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Water:</Text>
              <Text style={styles.infoValue}>
                {hostel.pricing.waterCharges 
                  ? hostel.pricing.waterCharges.charAt(0).toUpperCase() + hostel.pricing.waterCharges.slice(1)
                  : 'Included'}
              </Text>
            </View>
          </View>
        )}

        {/* Operating Hours */}
        {hostel.operatingHours && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Operating Hours</Text>
            {hostel.operatingHours.officeHours && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Office:</Text>
                <Text style={styles.infoValue}>{hostel.operatingHours.officeHours}</Text>
              </View>
            )}
            {hostel.operatingHours.checkInTime && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Check-in:</Text>
                <Text style={styles.infoValue}>{hostel.operatingHours.checkInTime}</Text>
              </View>
            )}
            {hostel.operatingHours.checkOutTime && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Check-out:</Text>
                <Text style={styles.infoValue}>{hostel.operatingHours.checkOutTime}</Text>
              </View>
            )}
            {hostel.operatingHours.maintenanceHours && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Maintenance:</Text>
                <Text style={styles.infoValue}>{hostel.operatingHours.maintenanceHours}</Text>
              </View>
            )}
          </View>
        )}

        {/* Rules */}
        {hostel.rules && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rules & Policies</Text>
            {hostel.rules.curfewTime && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Curfew Time:</Text>
                <Text style={styles.infoValue}>{hostel.rules.curfewTime}</Text>
              </View>
            )}
            {hostel.rules.weekendCurfewTime && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Weekend Curfew:</Text>
                <Text style={styles.infoValue}>{hostel.rules.weekendCurfewTime}</Text>
              </View>
            )}
            {hostel.rules.lateEntryFine > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Late Entry Fine:</Text>
                <Text style={styles.infoValue}>₹{hostel.rules.lateEntryFine}</Text>
              </View>
            )}
            {hostel.rules.visitorTimings && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Visitor Timings:</Text>
                <Text style={styles.infoValue}>{hostel.rules.visitorTimings}</Text>
              </View>
            )}
            {hostel.rules.messTimings && (
              <>
                <Text style={styles.subsectionTitle}>Mess Timings</Text>
                {hostel.rules.messTimings.breakfast && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Breakfast:</Text>
                    <Text style={styles.infoValue}>{hostel.rules.messTimings.breakfast}</Text>
                  </View>
                )}
                {hostel.rules.messTimings.lunch && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Lunch:</Text>
                    <Text style={styles.infoValue}>{hostel.rules.messTimings.lunch}</Text>
                  </View>
                )}
                {hostel.rules.messTimings.dinner && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Dinner:</Text>
                    <Text style={styles.infoValue}>{hostel.rules.messTimings.dinner}</Text>
                  </View>
                )}
              </>
            )}
            <View style={styles.policyRow}>
              <Ionicons name={hostel.rules.smokingAllowed ? 'checkmark-circle' : 'close-circle'} size={18} color={hostel.rules.smokingAllowed ? '#4CAF50' : '#f44336'} />
              <Text style={styles.policyText}>Smoking {hostel.rules.smokingAllowed ? 'Allowed' : 'Not Allowed'}</Text>
            </View>
            <View style={styles.policyRow}>
              <Ionicons name={hostel.rules.alcoholAllowed ? 'checkmark-circle' : 'close-circle'} size={18} color={hostel.rules.alcoholAllowed ? '#4CAF50' : '#f44336'} />
              <Text style={styles.policyText}>Alcohol {hostel.rules.alcoholAllowed ? 'Allowed' : 'Not Allowed'}</Text>
            </View>
            <View style={styles.policyRow}>
              <Ionicons name={hostel.rules.petsAllowed ? 'checkmark-circle' : 'close-circle'} size={18} color={hostel.rules.petsAllowed ? '#4CAF50' : '#f44336'} />
              <Text style={styles.policyText}>Pets {hostel.rules.petsAllowed ? 'Allowed' : 'Not Allowed'}</Text>
            </View>
          </View>
        )}

        {/* Business Info */}
        {hostel.businessInfo && (hostel.businessInfo.gstNumber || hostel.businessInfo.licenseNumber) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Information</Text>
            {hostel.businessInfo.gstNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>GST Number:</Text>
                <Text style={styles.infoValue}>{hostel.businessInfo.gstNumber}</Text>
              </View>
            )}
            {hostel.businessInfo.licenseNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>License Number:</Text>
                <Text style={styles.infoValue}>{hostel.businessInfo.licenseNumber}</Text>
              </View>
            )}
            {hostel.businessInfo.registrationNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Registration:</Text>
                <Text style={styles.infoValue}>{hostel.businessInfo.registrationNumber}</Text>
              </View>
            )}
            {hostel.businessInfo.panNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>PAN Number:</Text>
                <Text style={styles.infoValue}>{hostel.businessInfo.panNumber}</Text>
              </View>
            )}
          </View>
        )}
        </View>
      ) : null}

      {/* Edit Modal - Full comprehensive form */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Hostel</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#11181C" />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionTabs}>
              {sections.map((section) => (
                <TouchableOpacity
                  key={section.id}
                  style={[
                    styles.sectionTab,
                    activeSection === section.id && styles.sectionTabActive,
                  ]}
                  onPress={() => setActiveSection(section.id)}
                >
                  <Ionicons
                    name={section.icon as any}
                    size={16}
                    color={activeSection === section.id ? '#fff' : '#0a7ea4'}
                  />
                  <Text
                    style={[
                      styles.sectionTabText,
                      activeSection === section.id && styles.sectionTabTextActive,
                    ]}
                  >
                    {section.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={true}>
              {formData && renderEditSection()}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleUpdate}
              >
                <Text style={styles.submitButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
  imageContainer: {
    width: '100%',
    height: 250,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  indicatorActive: {
    backgroundColor: '#fff',
    width: 20,
  },
  uploadButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 20,
  },
  noImageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    marginTop: 10,
    fontSize: 14,
    color: '#999',
  },
  content: {
    padding: 15,
  },
  header: {
    marginBottom: 15,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#11181C',
    flex: 1,
  },
  badge: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: '#687076',
    lineHeight: 20,
  },
  address: {
    fontSize: 14,
    color: '#687076',
    marginTop: 5,
  },
  mapContainer: {
    marginTop: 10,
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#11181C',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#687076',
    marginTop: 5,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
    gap: 5,
  },
  amenityText: {
    fontSize: 14,
    color: '#11181C',
  },
  facilitiesList: {
    gap: 10,
  },
  facilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  facilityText: {
    fontSize: 14,
    color: '#687076',
  },
  nearbyPlace: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
    gap: 10,
  },
  nearbyPlaceInfo: {
    flex: 1,
  },
  nearbyPlaceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#11181C',
  },
  nearbyPlaceDistance: {
    fontSize: 12,
    color: '#687076',
  },
  galleryItem: {
    marginRight: 10,
    position: 'relative',
  },
  galleryImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  galleryActions: {
    position: 'absolute',
    top: 5,
    right: 5,
    flexDirection: 'row',
    gap: 5,
  },
  galleryAction: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 5,
    borderRadius: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#687076',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 20,
    marginHorizontal: 15,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
    marginTop: 15,
    marginBottom: 10,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  highlightText: {
    fontSize: 14,
    color: '#687076',
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    color: '#0a7ea4',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 5,
  },
  infoLabel: {
    fontSize: 14,
    color: '#687076',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#11181C',
    fontWeight: '600',
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  policyText: {
    fontSize: 14,
    color: '#687076',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalScroll: {
    padding: 20,
    maxHeight: 400,
  },
  sectionTabs: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 10,
  },
  sectionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    gap: 5,
  },
  sectionTabActive: {
    backgroundColor: '#0a7ea4',
  },
  sectionTabText: {
    fontSize: 12,
    color: '#0a7ea4',
    fontWeight: '600',
  },
  sectionTabTextActive: {
    color: '#fff',
  },
  formScroll: {
    maxHeight: 400,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  typeButtonText: {
    color: '#11181C',
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  optionButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  optionButtonActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  optionButtonText: {
    color: '#11181C',
    fontSize: 14,
    fontWeight: '500',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingVertical: 5,
  },
  switchLabel: {
    fontSize: 16,
    color: '#11181C',
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 10,
  },
  tagContainer: {
    marginBottom: 20,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  tagInput: {
    flex: 1,
    marginBottom: 0,
  },
  addTagButton: {
    backgroundColor: '#0a7ea4',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#11181C',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0a7ea4',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  uploadImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 15,
  },
  uploadImageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    marginTop: 15,
  },
  imagePreviewItem: {
    marginRight: 10,
    position: 'relative',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  imagePreviewActions: {
    position: 'absolute',
    top: 5,
    right: 5,
    flexDirection: 'row',
    gap: 5,
  },
  imagePreviewAction: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 4,
  },
  coverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  coverBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '600',
  },
  imageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderRadius: 0,
    overflow: 'hidden',
  },
  galleryImageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  imageHidden: {
    opacity: 0,
  },
});

