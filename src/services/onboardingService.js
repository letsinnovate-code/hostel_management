/**
 * @file services/onboardingService.js
 * @description Domain service for Student Onboarding state machine, document validation, fee calculation, and user sync.
 */

'use strict';

const User = require('../models/User');
const Room = require('../models/Room');
const FeeStructure = require('../models/FeeStructure');

class OnboardingService {
  /**
   * Secure URL validation preventing SSRF, file://, javascript://, and private IP leaks.
   */
  static validateDocumentUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (/^(javascript|data|file|vbscript):/i.test(trimmed)) {
      return false;
    }
    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '169.254.169.254' ||
        hostname.endsWith('.internal') ||
        (hostname.endsWith('.local') && hostname !== 'hostelzify-media.local') ||
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
      ) {
        if (hostname === 'hostelzify-media.local') return true;
        return false;
      }
      const allowedPatterns = [
        /\.amazonaws\.com$/,
        /^amazonaws\.com$/,
        /\.digitaloceanspaces\.com$/,
        /hostelzify/i,
      ];
      return allowedPatterns.some((pattern) => pattern.test(hostname));
    } catch {
      return false;
    }
  }

  /**
   * Calculate student onboarding progress percentage dynamically
   */
  static calculateProgress(onboarding) {
    if (!onboarding) return 0;
    let progress = 10; // Base registration

    // Profile (Personal + Academic)
    const p = onboarding.personalInfo || {};
    const a = onboarding.academicInfo || {};
    if (p.fullName && p.phone && a.course && a.studentIdNumber) {
      progress += 20;
    } else if (p.fullName && p.phone) {
      progress += 10;
    }

    // Parent & Emergency Contacts
    const parent = onboarding.parentInfo || {};
    const em = onboarding.emergencyContact || {};
    if (parent.name && parent.phone && em.name && em.phone) {
      progress += 15;
    } else if (parent.name && parent.phone) {
      progress += 10;
    }

    // Documents
    const docs = onboarding.documents || [];
    const hasAadhar = docs.some((d) => d.documentType === 'aadhar' && d.fileUrl);
    const hasPhoto = docs.some((d) => d.documentType === 'photo' && d.fileUrl);
    if (hasAadhar && hasPhoto) {
      progress += 20;
    } else if (hasAadhar || hasPhoto) {
      progress += 10;
    }

    // Hostel & Room selection
    if (onboarding.hostelId && onboarding.roomPreferences?.selectedRoomId) {
      progress += 15;
    } else if (onboarding.hostelId) {
      progress += 10;
    }

    // Payment / Fee Confirmation
    if (onboarding.paymentInfo?.paymentStatus === 'PAID') {
      progress += 10;
    }

    // Agreement
    if (onboarding.rulesAgreement?.agreed) {
      progress += 10;
    }

    return Math.min(100, progress);
  }

  /**
   * Synchronize approved onboarding details back into the primary User record
   */
  static async syncUserFromOnboarding(studentId, onboarding) {
    const user = await User.findById(studentId);
    if (!user) return null;

    const p = onboarding.personalInfo || {};
    const a = onboarding.academicInfo || {};
    const parent = onboarding.parentInfo || {};
    const em = onboarding.emergencyContact || {};

    if (p.fullName) user.name = p.fullName;
    if (p.phone) user.phone = p.phone;
    if (p.dateOfBirth) user.dateOfBirth = p.dateOfBirth;
    if (p.bloodGroup) user.bloodGroup = p.bloodGroup;
    if (p.gender) user.gender = p.gender;
    if (p.permanentAddress) user.permanentAddress = p.permanentAddress;

    if (a.course) user.course = a.course;
    if (a.branch) user.branch = a.branch;
    if (a.year) user.year = a.year;
    if (a.studentIdNumber) user.admissionNumber = a.studentIdNumber;

    if (parent.name) user.parentName = parent.name;
    if (parent.phone) user.parentPhone = parent.phone;
    if (parent.email) user.parentEmail = parent.email;

    if (onboarding.hostelId) user.hostelId = onboarding.hostelId;
    if (onboarding.roomPreferences?.selectedRoomId) {
      user.roomId = onboarding.roomPreferences.selectedRoomId;
    }
    if (onboarding.roomPreferences?.allocatedBedNumber) {
      user.bedNumber = onboarding.roomPreferences.allocatedBedNumber;
    }

    user.isOnboarded = true;
    user.status = 'active';
    user.isActive = true;

    await user.save();
    return user;
  }
}

module.exports = OnboardingService;
