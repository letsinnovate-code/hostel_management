/**
 * Specialized Authentication & User Profile Types (Split Interfaces)
 */

import {
  Role,
  UserStatus,
  OnboardingStatus,
  LocationCoordinates,
  Address,
  AcademicInfo,
  ContactPerson,
  StudentDocument,
  PresenceStatus,
} from './domain';

/**
 * Minimal, focused authenticated user payload stored in sessions & auth tokens
 */
export interface AuthUser {
  _id?: string;
  id: string;
  name: string;
  email: string;
  role?: Role | Role[] | string | string[];
  roles?: any[];
  currentRole?: Role | null;
  phone?: string;
  hostelId?: string;
  hostelName?: string;
  roomId?: string;
  room?: string;
  bedNumber?: string;
  status?: UserStatus;
  onboardingStatus?: OnboardingStatus;
  profileImage?: string;
  hasMultipleRoles?: boolean;
  address?: Address;
  businessInfo?: {
    companyName?: string;
    taxId?: string;
    gstNumber?: string;
    registrationNumber?: string;
    [key: string]: unknown;
  };
  planId?: any;
  studentId?: string;
  token?: string;
}

/**
 * Detailed Student Profile
 */
export interface StudentProfile {
  _id?: string;
  id: string;
  studentId?: string;
  name: string;
  email: string;
  phone: string;
  hostelId: string;
  hostelName?: string;
  blockId?: string;
  roomId?: string;
  room?: string;
  bedNumber?: string;
  status: UserStatus;
  onboardingStatus: OnboardingStatus;
  profileImage?: string;
  gender?: 'male' | 'female' | 'other';
  course?: string;
  year?: string;
  academicInfo?: AcademicInfo;
  parentContact?: ContactPerson;
  parentInfo?: ContactPerson;
  emergencyContact?: ContactPerson;
  address?: Address;
  documents?: StudentDocument[];
  currentLocation?: LocationCoordinates;
  presenceStatus?: PresenceStatus;
  createdAt?: string | Date;
}

/**
 * Staff User (Cleaners, Supervisors, Security)
 */
export interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'cleaner' | 'supervisor' | 'security' | 'warden';
  hostelId: string;
  status: UserStatus;
  profileImage?: string;
  assignedBlocks?: string[];
  createdAt?: string | Date;
}

/**
 * Owner Profile
 */
export interface OwnerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  hostelsCount?: number;
  totalCapacity?: number;
  totalOccupancy?: number;
  status: UserStatus;
  profileImage?: string;
  createdAt?: string | Date;
}

/**
 * Warden Profile
 */
export interface WardenProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  hostelId: string;
  hostelName?: string;
  status: UserStatus;
  profileImage?: string;
  emergencyContact?: ContactPerson;
  createdAt?: string | Date;
}

/**
 * Auth Requests & Responses
 */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse extends AuthUser {
  token: string;
  user?: AuthUser;
}

export interface RegisterResponse extends AuthUser {
  token?: string;
  user?: AuthUser;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  role?: Role | Role[];
  hostelId?: string;
  [key: string]: unknown;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
