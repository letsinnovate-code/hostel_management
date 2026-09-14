/**
 * Core Domain Entity Types for Hostelzify
 */

export type Role =
  | 'owner'
  | 'warden'
  | 'cleaner'
  | 'supervisor'
  | 'student'
  | 'security'
  | 'superadmin';

export type UserStatus = 'active' | 'on-leave' | 'exited' | 'suspended' | 'pending_onboarding';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';

export type PresenceStatus = 'inside' | 'outside' | 'checked in' | 'checked out' | 'on-leave' | 'unknown';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  timestamp?: Date | string;
  accuracy?: number;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  formattedAddress?: string;
  placeId?: string;
}

export interface AcademicInfo {
  college?: string;
  department?: string;
  semester?: string;
  admissionNumber?: string;
  studentIdNumber?: string;
  course?: string;
}

export interface ContactPerson {
  name: string;
  phone: string;
  email?: string;
  relation?: string;
  relationship?: string;
  address?: string;
  occupation?: string;
}

export interface StudentDocument {
  _id?: string;
  type: string;
  name: string;
  url: string;
  uploadedAt?: Date | string;
}

/** Base User domain model */
export interface User {
  _id?: string;
  id: string;
  name: string;
  email: string;
  role: Role | Role[];
  roles?: Role[];
  currentRole?: Role | null;
  phone?: string;
  hostelId?: string;
  blockId?: string;
  roomId?: string;
  room?: string;
  bedNumber?: string;
  status?: UserStatus;
  onboardingStatus?: OnboardingStatus;
  profileImage?: string;
  createdAt?: string | Date;
  lastLogin?: string | Date;
  currentLocation?: LocationCoordinates;
  locationPermissionStatus?: 'granted' | 'denied' | 'not_requested';
}

/** Student domain entity */
export interface Student extends User {
  studentId?: string;
  planId?: string;
  academicInfo?: AcademicInfo;
  parentContact?: ContactPerson;
  parentInfo?: ContactPerson;
  emergencyContact?: ContactPerson;
  documents?: StudentDocument[];
  address?: Address;
  gender?: 'male' | 'female' | 'other';
  course?: string;
  year?: string;
  presenceStatus?: PresenceStatus;
}

/** Owner domain entity */
export interface Owner extends User {
  hostelsCount?: number;
  activeStudentsCount?: number;
}

/** Warden domain entity */
export interface Warden extends User {
  assignedHostelId?: string;
  hostelName?: string;
}

/** Hostel domain entity */
export interface Hostel {
  _id?: string;
  id: string;
  name: string;
  type: 'boys' | 'girls' | 'co-ed';
  address: Address;
  timezone?: string;
  contact: {
    phone?: string;
    email?: string;
    alternatePhone?: string;
    managerName?: string;
    managerPhone?: string;
    managerEmail?: string;
    wardenName?: string;
    wardenPhone?: string;
    wardenEmail?: string;
  };
  ownerId: string;
  capacity: number;
  currentOccupancy: number;
  availableRooms: number;
  totalRooms: number;
  rules?: string[];
  amenities?: string[];
  images?: string[];
  coverImage?: string;
  status?: 'active' | 'inactive';
  geoFence?: {
    type?: 'polygon' | 'rectangle';
    bounds?: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
    polygon?: Array<{ latitude: number; longitude: number }>;
  };
  createdAt?: string | Date;
}

/** Room category and pricing */
export type RoomCategory = 'AC' | 'Non-AC' | 'Deluxe' | 'Standard' | (string & {});
export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'unavailable' | (string & {});

export interface RoomPricing {
  monthly?: number;
  yearly?: number;
  perBed?: number;
}

/** Room domain entity */
export interface Room {
  _id?: string;
  id: string;
  roomNumber: string;
  hostelId?: string | Hostel | { _id?: string; id?: string; name?: string; [key: string]: unknown };
  blockId?: string | { _id?: string; id?: string; name?: string; [key: string]: unknown };
  floorNumber: number;
  capacity: number;
  currentOccupancy: number;
  students?: Array<Student | string | Record<string, unknown>>;
  status: RoomStatus;
  category: RoomCategory;
  pricing?: RoomPricing;
  amenities?: string[];
  images?: string[];
  coverImage?: string;
  description?: string;
  createdAt?: string | Date;
}

/** Bed representation */
export interface Bed {
  bedNumber: string;
  roomId: string;
  roomNumber?: string;
  studentId?: string | null;
  studentName?: string | null;
  isOccupied: boolean;
}

/** Attendance domain entity */
export type AttendanceStatusType = 'present' | 'absent' | 'late' | 'on-leave' | 'pending';
export type PresenceType = 'inside' | 'outside' | 'pending' | 'on-leave' | 'present' | 'absent' | 'late';

export interface Attendance {
  _id?: string;
  id: string;
  studentId: string | Student;
  hostelId: string | Hostel;
  status: PresenceType;
  attendanceStatus: AttendanceStatusType;
  isLate: boolean;
  remarks?: string;
  markedBy?: string;
  lastEditedBy?: string;
  lastEditedAt?: string | Date;
  editReason?: string;
  checkInTime?: string | Date;
  checkOutTime?: string | Date;
  location?: {
    latitude: number;
    longitude: number;
  };
  accuracy?: number;
  distanceFromHostel?: number;
  capturedAt?: string | Date;
  serverReceivedAt?: string | Date;
  createdAt?: string | Date;
}

/** Complaint domain entity */
export type ComplaintType = 'cleaning' | 'food' | 'safety' | 'maintenance' | 'other';
export type ComplaintStatus = 'open' | 'assigned' | 'in-progress' | 'resolved' | 'closed' | 'reopened';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Complaint {
  _id?: string;
  id: string;
  raisedBy: string | Student;
  complaintType: ComplaintType;
  title: string;
  description: string;
  roomId?: string | Room;
  hostelId: string | Hostel;
  blockId?: string;
  assignedTo?: string | User;
  assignedStaffName?: string;
  assignedStaffPhone?: string;
  assignedStaffRole?: string;
  assignedAt?: string | Date;
  status: ComplaintStatus;
  priority?: ComplaintPriority;
  images?: string[];
  resolutionNotes?: string;
  resolvedAt?: string | Date;
  resolvedBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Permission / Leave domain entity */
export type PermissionType =
  | 'late-entry'
  | 'leave'
  | 'overnight'
  | 'multi-day'
  | 'night-out'
  | 'day-pass'
  | 'emergency'
  | 'medical'
  | 'vacation'
  | 'other';

export type PermissionStatus =
  | 'pending'
  | 'approved'
  | 'checked-out'
  | 'returned'
  | 'rejected'
  | 'cancelled';

export interface Permission {
  _id?: string;
  id: string;
  studentId: string | Student;
  hostelId?: string | Hostel;
  permissionType: PermissionType;
  reason: string;
  destination?: string;
  requestedDate: string | Date;
  returnDate?: string | Date;
  actualCheckOutTime?: string | Date;
  actualReturnTime?: string | Date;
  status: PermissionStatus;
  approvedBy?: string | User;
  approvedAt?: string | Date;
  rejectionReason?: string;
  wardenRemarks?: string;
  cancelledBy?: string | User;
  cancelledAt?: string | Date;
  cancellationReason?: string;
  supportingDocuments?: Array<{
    name: string;
    url: string;
    type?: string;
  }>;
  createdAt?: string | Date;
}

/** Visitor domain entity */
export type VisitorStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface Visitor {
  _id?: string;
  id: string;
  visitorName: string;
  visitorPhone: string;
  visitorIdProof?: string;
  visitingStudentId: string | Student;
  purpose: string;
  visitDate?: string | Date;
  entryTime?: string | Date;
  exitTime?: string | Date;
  approvedBy?: string | User;
  status: VisitorStatus;
  rejectionReason?: string;
  createdAt?: string | Date;
}

/** Payment domain entity */
export type PaymentType = 'hostel_rent' | 'fine' | 'mess' | 'maintenance' | 'other';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cash' | 'other';

export interface Payment {
  _id?: string;
  id: string;
  studentId: string | Student;
  hostelId: string | Hostel;
  type: PaymentType;
  amount: number;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  transactionId?: string;
  razorpayOrderId?: string;
  invoiceId?: string;
  dueDate?: string | Date;
  paidDate?: string | Date;
  periodStart?: string | Date;
  periodEnd?: string | Date;
  planId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string | Date;
}

/** Notification domain entity */
export type NotificationType = 'announcement' | 'alert' | 'reminder' | 'emergency';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  _id?: string;
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  hostelId?: string;
  targetAudience: 'all' | 'students' | 'staff' | 'wardens' | 'cleaners' | 'owner' | 'superadmin';
  recipients?: string[];
  createdBy: string;
  priority: NotificationPriority;
  expiresAt?: string | Date;
  isRead?: Array<{ userId: string; readAt: string | Date }>;
  createdAt?: string | Date;
}
