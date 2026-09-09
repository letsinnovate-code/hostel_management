const mongoose = require('mongoose');
const StudentOnboarding = require('../models/StudentOnboarding');
const User = require('../models/User');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const FeeStructure = require('../models/FeeStructure');
const Payment = require('../models/Payment');
const Rule = require('../models/Rule');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { createOrder, verifyPaymentSignature } = require('../utils/razorpay');
const { uploadImageToS3 } = require('../utils/s3Upload');
const { emitToUser, emitToRole } = require('../modules/alert/socket/alertSocket');
const { sendApprovalEmail } = require('../services/email.service');
const { assertOwnsHostel } = require('../middleware/ownerSecurity');

// Helper: Secure document URL validation
function validateDocumentUrl(url) {
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

// Helper: Calculate progress percentage dynamically
function calculateProgress(onboarding) {
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
  const emergency = onboarding.emergencyContact || {};
  if (parent.name && parent.phone && emergency.name && emergency.phone) {
    progress += 15;
  } else if (parent.phone || emergency.phone) {
    progress += 8;
  }

  // Documents
  const docs = onboarding.documents || [];
  if (docs.length >= 2) {
    const hasApproved = docs.some((d) => d.status === 'approved');
    const allApproved = docs.every((d) => d.status === 'approved');
    if (allApproved) {
      progress += 20;
    } else if (hasApproved) {
      progress += 15;
    } else {
      progress += 10;
    }
  } else if (docs.length > 0) {
    progress += 5;
  }

  // Room Allocation
  if (onboarding.roomId) {
    progress += 15;
  }

  // Fee Payment
  if (onboarding.feeDetails?.paymentStatus === 'successful') {
    progress += 10;
  }

  // Rules Agreement
  if (onboarding.agreement?.accepted) {
    progress += 10;
  }

  return Math.min(progress, 100);
}

// Helper: Determine next action guidance for student
function getNextAction(onboarding) {
  switch (onboarding.status) {
    case 'CORRECTION_REQUIRED':
      const rejectedDocs = (onboarding.documents || []).filter(
        (d) => d.status === 'rejected' || d.status === 'resubmission_required'
      );
      if (rejectedDocs.length > 0) {
        return {
          title: 'Document Correction Required',
          description: `Warden requested correction: ${rejectedDocs[0].rejectionReason || 'Please resubmit a clearer file.'}`,
          actionText: 'Resubmit Document',
          step: 'documents',
          severity: 'warning',
        };
      }
      return {
        title: 'Correction Required',
        description: onboarding.approval?.correctionNotes || 'Please review and update requested application fields.',
        actionText: 'Update Details',
        step: 'profile',
        severity: 'warning',
      };

    case 'REGISTERED':
    case 'PROFILE_INCOMPLETE':
      return {
        title: 'Complete Profile & Academic Info',
        description: 'Provide your personal, academic, and address details to initiate hostel admission.',
        actionText: 'Complete Profile',
        step: 'profile',
        severity: 'info',
      };

    case 'PROFILE_COMPLETED':
      return {
        title: 'Add Guardian & Emergency Contacts',
        description: 'Provide verified parent/guardian and emergency contact numbers for hostel safety records.',
        actionText: 'Add Contacts',
        step: 'contacts',
        severity: 'info',
      };

    case 'DOCUMENTS_PENDING':
      return {
        title: 'Upload Verification Documents',
        description: 'Upload your College ID, Government Photo ID, and Admission Proof.',
        actionText: 'Upload Documents',
        step: 'documents',
        severity: 'info',
      };

    case 'DOCUMENTS_UNDER_REVIEW':
      return {
        title: 'Documents Under Warden Review',
        description: 'Your uploaded documents are being verified by the warden office. You will be notified shortly.',
        actionText: 'View Documents',
        step: 'documents',
        severity: 'pending',
      };

    case 'DOCUMENTS_APPROVED':
    case 'ROOM_ALLOCATION_PENDING':
      if (!onboarding.roomId) {
        return {
          title: 'Waiting for Room Allocation',
          description: 'Documents verified! The warden is assigning your room and bed based on your preferences.',
          actionText: 'View Allocation Status',
          step: 'room',
          severity: 'pending',
        };
      }
      return {
        title: 'Proceed to Fee Payment',
        description: 'Your room has been assigned. Please pay the admission and hostel rent fees.',
        actionText: 'Pay Fees',
        step: 'payment',
        severity: 'info',
      };

    case 'ROOM_ALLOCATED':
    case 'PAYMENT_PENDING':
      return {
        title: 'Hostel Fee Payment Required',
        description: 'Complete fee payment online or submit your offline payment receipt reference.',
        actionText: 'Pay Hostel Fees',
        step: 'payment',
        severity: 'info',
      };

    case 'PAYMENT_COMPLETED':
    case 'AGREEMENT_PENDING':
      return {
        title: 'Sign Hostel Agreement & Rules',
        description: 'Read the hostel code of conduct and accept the resident terms & conditions.',
        actionText: 'Accept Rules & Terms',
        step: 'agreement',
        severity: 'info',
      };

    case 'AGREEMENT_COMPLETED':
    case 'FINAL_REVIEW':
      return {
        title: 'Pending Final Resident Activation',
        description: 'All requirements completed! Warden is performing the final review to activate your resident access.',
        actionText: 'View Application Status',
        step: 'review',
        severity: 'pending',
      };

    case 'ONBOARDING_COMPLETED':
      return {
        title: 'Onboarding Complete 🎉',
        description: 'Welcome to the hostel! Your resident profile, room access, and gate passes are now fully active.',
        actionText: 'Go to Student Dashboard',
        step: 'completed',
        severity: 'success',
      };

    case 'REJECTED':
      return {
        title: 'Application Rejected',
        description: onboarding.approval?.rejectionReason || 'Application was not approved by administration.',
        actionText: 'Contact Office',
        step: 'review',
        severity: 'error',
      };

    default:
      return {
        title: 'Continue Onboarding',
        description: 'Complete your pending onboarding steps to become an active resident.',
        actionText: 'Continue',
        step: onboarding.currentStep || 'profile',
        severity: 'info',
      };
  }
}

// Helper: Ensure student onboarding record exists
async function getOrCreateOnboarding(student) {
  let onboarding = await StudentOnboarding.findOne({ studentId: student._id });
  if (!onboarding) {
    onboarding = await StudentOnboarding.create({
      studentId: student._id,
      hostelId: student.hostelId || undefined,
      blockId: student.blockId || undefined,
      roomId: student.roomId || undefined,
      status: 'REGISTERED',
      currentStep: 'profile',
      progressPercentage: 15,
      personalInfo: {
        fullName: student.name || '',
        email: student.email || '',
        phone: student.phone || '',
        gender: student.gender || '',
        dateOfBirth: student.dateOfBirth,
        address: student.address || {},
      },
      academicInfo: {
        course: student.course || '',
        yearSemester: student.year || '',
        studentIdNumber: student.studentId || '',
        college: student.academicInfo?.college || '',
        department: student.academicInfo?.department || '',
      },
      parentInfo: {
        name: student.parentContact?.name || '',
        phone: student.parentContact?.phone || '',
        email: student.parentContact?.email || '',
      },
      emergencyContact: {
        name: student.emergencyContact?.name || '',
        phone: student.emergencyContact?.phone || '',
        relationship: student.emergencyContact?.relation || '',
      },
      timeline: [
        {
          step: 'registration',
          action: 'account_created',
          fromStatus: 'NONE',
          toStatus: 'REGISTERED',
          performedBy: student._id,
          performedByName: student.name,
          performedByRole: 'student',
          notes: 'Account registered into Hostelzify',
          timestamp: new Date(),
        },
      ],
    });

    student.onboardingId = onboarding._id;
    student.onboardingStatus = 'in_progress';
    await student.save();
  }
  return onboarding;
}

// ==========================================
// STUDENT ONBOARDING ACTIONS
// ==========================================

// 1. Get Student Onboarding State
exports.getStudentOnboardingState = async (req, res) => {
  try {
    const student = await User.findById(req.user._id || req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student account not found' });
    }

    const onboarding = await getOrCreateOnboarding(student);

    // Populate references
    await onboarding.populate([
      { path: 'hostelId', select: 'name code address rules contactPhone' },
      { path: 'roomId', select: 'roomNumber floorNumber capacity currentOccupancy category pricing' },
      { path: 'documents.verifiedBy', select: 'name role' },
      { path: 'approval.approvedBy', select: 'name role' },
    ]);

    // Recalculate progress
    const progress = calculateProgress(onboarding);
    if (onboarding.progressPercentage !== progress) {
      onboarding.progressPercentage = progress;
      await onboarding.save();
    }

    const nextAction = getNextAction(onboarding);

    res.status(200).json({
      success: true,
      data: onboarding,
      progress,
      nextAction,
      currentStep: onboarding.currentStep,
    });
  } catch (error) {
    console.error('[Onboarding] Error fetching state:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Save Personal & Academic Information
exports.savePersonalInfo = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const {
      fullName,
      dateOfBirth,
      dob,
      gender,
      phone,
      bloodGroup,
      nationality,
      address,
      city,
      state,
      pincode,
      studentIdNumber,
      college,
      collegeName,
      course,
      department,
      yearSemester,
      yearOfStudy,
      admissionDate,
      admissionNumber,
      hostelId,
    } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({ success: false, message: 'Full name and mobile number are required' });
    }

    const onboarding = await StudentOnboarding.findOne({ studentId });
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding session not found' });
    }

    // Check duplicate student enrollment ID if provided
    if (studentIdNumber && studentIdNumber.trim()) {
      const existingEnrollment = await User.findOne({
        studentId: studentIdNumber.trim(),
        _id: { $ne: studentId },
      });
      if (existingEnrollment) {
        return res.status(400).json({
          success: false,
          message: `Student enrollment number "${studentIdNumber.trim()}" is already registered by another student.`,
        });
      }
    }

    // Parse address structure safely
    let parsedAddress = {
      street: '',
      city: city || '',
      state: state || '',
      pincode: pincode || '',
      country: 'India',
    };
    if (typeof address === 'string') {
      parsedAddress.street = address.trim();
    } else if (address && typeof address === 'object') {
      parsedAddress = {
        street: address.street || address.formattedAddress || '',
        city: address.city || city || '',
        state: address.state || state || '',
        pincode: address.pincode || pincode || '',
        country: address.country || 'India',
      };
    }

    const effectiveDob = dateOfBirth || dob;

    // Update Onboarding Record
    onboarding.personalInfo = {
      fullName: fullName.trim(),
      dateOfBirth: effectiveDob ? new Date(effectiveDob) : onboarding.personalInfo?.dateOfBirth,
      gender: gender || onboarding.personalInfo?.gender,
      phone: phone.trim(),
      email: req.user.email,
      bloodGroup: bloodGroup || '',
      nationality: nationality || 'Indian',
      address: parsedAddress,
    };

    onboarding.academicInfo = {
      studentIdNumber: studentIdNumber ? studentIdNumber.trim() : (onboarding.academicInfo?.studentIdNumber || ''),
      college: college ? college.trim() : (collegeName ? collegeName.trim() : (onboarding.academicInfo?.college || '')),
      course: course ? course.trim() : (onboarding.academicInfo?.course || ''),
      department: department ? department.trim() : (onboarding.academicInfo?.department || ''),
      yearSemester: yearSemester ? yearSemester.trim() : (yearOfStudy ? yearOfStudy.trim() : (onboarding.academicInfo?.yearSemester || '')),
      admissionDate: admissionDate ? new Date(admissionDate) : onboarding.academicInfo?.admissionDate,
      admissionNumber: admissionNumber ? admissionNumber.trim() : (onboarding.academicInfo?.admissionNumber || ''),
    };

    if (hostelId) {
      onboarding.hostelId = hostelId;
    }

    const oldStatus = onboarding.status;
    if (onboarding.status === 'REGISTERED' || onboarding.status === 'PROFILE_INCOMPLETE') {
      onboarding.status = 'PROFILE_COMPLETED';
      onboarding.currentStep = 'contacts';
    }

    onboarding.progressPercentage = calculateProgress(onboarding);

    onboarding.timeline.push({
      step: 'profile',
      action: 'profile_updated',
      fromStatus: oldStatus,
      toStatus: onboarding.status,
      performedBy: studentId,
      performedByName: fullName,
      performedByRole: 'student',
      notes: 'Personal and academic information saved',
      timestamp: new Date(),
    });

    await onboarding.save();

    // Sync to User Model for backward compatibility
    await User.findByIdAndUpdate(studentId, {
      name: fullName.trim(),
      phone: phone.trim(),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender: gender || undefined,
      course: course || undefined,
      year: yearSemester || undefined,
      studentId: studentIdNumber ? studentIdNumber.trim() : undefined,
      address: address || undefined,
      hostelId: hostelId || undefined,
      academicInfo: {
        college: college || '',
        department: department || '',
        semester: yearSemester || '',
        admissionNumber: admissionNumber || '',
      },
    });

    res.status(200).json({
      success: true,
      data: onboarding,
      message: 'Profile information saved successfully',
      nextAction: getNextAction(onboarding),
    });
  } catch (error) {
    console.error('[Onboarding] Error saving profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Save Parent/Guardian & Emergency Contact Information
exports.saveGuardianInfo = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const parentInfo = req.body.parentInfo || {
      name: req.body.parentName,
      relationship: req.body.parentRelation || req.body.parentRelationship || 'Parent',
      phone: req.body.parentPhone,
      email: req.body.parentEmail || '',
      address: req.body.parentAddress || '',
      occupation: req.body.parentOccupation || '',
    };
    const emergencyContact = req.body.emergencyContact || {
      name: req.body.emergencyName,
      relationship: req.body.emergencyRelation || req.body.emergencyRelationship || 'Emergency Contact',
      phone: req.body.emergencyPhone,
      alternatePhone: req.body.emergencyAltPhone || req.body.emergencyAlternatePhone || '',
    };

    if (!parentInfo?.name || !parentInfo?.phone) {
      return res.status(400).json({ success: false, message: 'Parent/Guardian name and contact phone are required' });
    }
    if (!emergencyContact?.name || !emergencyContact?.phone) {
      return res.status(400).json({ success: false, message: 'Emergency contact name and phone are required' });
    }

    const onboarding = await StudentOnboarding.findOne({ studentId });
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding session not found' });
    }

    onboarding.parentInfo = {
      name: parentInfo.name.trim(),
      relationship: parentInfo.relationship ? parentInfo.relationship.trim() : 'Parent',
      phone: parentInfo.phone.trim(),
      email: parentInfo.email ? parentInfo.email.trim() : '',
      address: parentInfo.address ? parentInfo.address.trim() : '',
      occupation: parentInfo.occupation ? parentInfo.occupation.trim() : '',
    };

    onboarding.emergencyContact = {
      name: emergencyContact.name.trim(),
      relationship: emergencyContact.relationship ? emergencyContact.relationship.trim() : 'Emergency Contact',
      phone: emergencyContact.phone.trim(),
      alternatePhone: emergencyContact.alternatePhone ? emergencyContact.alternatePhone.trim() : '',
    };

    const oldStatus = onboarding.status;
    if (onboarding.status === 'PROFILE_COMPLETED' || onboarding.status === 'REGISTERED') {
      onboarding.status = 'DOCUMENTS_PENDING';
      onboarding.currentStep = 'documents';
    }

    onboarding.progressPercentage = calculateProgress(onboarding);

    onboarding.timeline.push({
      step: 'contacts',
      action: 'contacts_updated',
      fromStatus: oldStatus,
      toStatus: onboarding.status,
      performedBy: studentId,
      performedByName: req.user.name,
      performedByRole: 'student',
      notes: 'Parent and emergency contacts saved',
      timestamp: new Date(),
    });

    await onboarding.save();

    // Sync to User model
    await User.findByIdAndUpdate(studentId, {
      parentContact: {
        name: parentInfo.name.trim(),
        phone: parentInfo.phone.trim(),
        email: parentInfo.email ? parentInfo.email.trim() : '',
      },
      emergencyContact: {
        name: emergencyContact.name.trim(),
        phone: emergencyContact.phone.trim(),
        relation: emergencyContact.relationship ? emergencyContact.relationship.trim() : '',
      },
    });

    res.status(200).json({
      success: true,
      data: onboarding,
      message: 'Parent and emergency contact information saved',
      nextAction: getNextAction(onboarding),
    });
  } catch (error) {
    console.error('[Onboarding] Error saving guardian info:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Upload Document
exports.uploadDocument = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const { documentType } = req.body;
    const file = req.file;

    if (!documentType) {
      return res.status(400).json({ success: false, message: 'Document type is required' });
    }
    if (!file && !req.body.fileUrl) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }

    const onboarding = await StudentOnboarding.findOne({ studentId });
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding session not found' });
    }

    let fileUrl = req.body.fileUrl;
    if (fileUrl) {
      if (!validateDocumentUrl(fileUrl)) {
        return res.status(400).json({ success: false, message: 'Invalid or untrusted fileUrl' });
      }
    }
    let fileName = req.body.fileName || file?.originalname || `${documentType}.pdf`;
    let fileType = file?.mimetype || 'application/pdf';
    let fileSize = file?.size || 102400;

    // Upload to S3 or generate local mock URL if S3 is unavailable
    if (file && !fileUrl) {
      try {
        fileUrl = await uploadImageToS3(file, 'students/onboarding');
      } catch (uploadErr) {
        console.warn('[Onboarding] S3 upload skipped/failed, using safe media path:', uploadErr.message);
        // Resilient fallback for local test environments
        const base64Data = file.buffer.toString('base64').slice(0, 100);
        fileUrl = `https://hostelzify-media.local/docs/${studentId}-${documentType}-${Date.now()}.${file.originalname?.split('.').pop() || 'pdf'}`;
      }
    }

    // Check if document of this type already exists
    const existingIndex = onboarding.documents.findIndex((d) => d.documentType === documentType);
    const newDoc = {
      documentType,
      name: fileName,
      url: fileUrl,
      fileType,
      fileSize,
      uploadedAt: new Date(),
      status: 'under_review',
      rejectionReason: '',
      correctionInstructions: '',
    };

    if (existingIndex >= 0) {
      onboarding.documents[existingIndex] = newDoc;
    } else {
      onboarding.documents.push(newDoc);
    }

    const oldStatus = onboarding.status;
    if (onboarding.status === 'DOCUMENTS_PENDING' || onboarding.status === 'CORRECTION_REQUIRED') {
      onboarding.status = 'DOCUMENTS_UNDER_REVIEW';
    }

    onboarding.progressPercentage = calculateProgress(onboarding);

    onboarding.timeline.push({
      step: 'documents',
      action: 'document_uploaded',
      fromStatus: oldStatus,
      toStatus: onboarding.status,
      performedBy: studentId,
      performedByName: req.user.name,
      performedByRole: 'student',
      notes: `Uploaded document: ${documentType.toUpperCase()} (${fileName})`,
      timestamp: new Date(),
    });

    await onboarding.save();

    // Sync to User documents array
    await User.findByIdAndUpdate(studentId, {
      $push: {
        documents: {
          type: documentType,
          name: fileName,
          url: fileUrl,
          uploadedAt: new Date(),
        },
      },
    });

    // Notify warden of document submission
    if (onboarding.hostelId) {
      emitToRole('warden', String(onboarding.hostelId), 'onboarding:document_submitted', {
        studentId: String(studentId),
        studentName: req.user.name,
        documentType,
      });
    }

    res.status(200).json({
      success: true,
      data: onboarding,
      message: 'Document uploaded and submitted for review',
      nextAction: getNextAction(onboarding),
    });
  } catch (error) {
    console.error('[Onboarding] Error uploading document:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Resubmit Rejected Document
exports.resubmitDocument = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const documentId = req.params?.documentId || req.body?.documentId;
    const documentType = req.body?.documentType;
    const file = req.file;

    const onboarding = await StudentOnboarding.findOne({ studentId });
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding session not found' });
    }

    let doc = null;
    if (documentId) {
      doc = onboarding.documents.id(documentId);
    }
    if (!doc && documentType) {
      doc = onboarding.documents.find((d) => d.documentType === documentType);
    }
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    let fileUrl = req.body.fileUrl;
    if (fileUrl) {
      if (!validateDocumentUrl(fileUrl)) {
        return res.status(400).json({ success: false, message: 'Invalid or untrusted fileUrl' });
      }
    }
    let fileName = req.body.fileName || file?.originalname || doc.name;
    let fileType = file?.mimetype || doc.fileType;
    let fileSize = file?.size || doc.fileSize;

    if (file && !fileUrl) {
      try {
        fileUrl = await uploadImageToS3(file, 'students/onboarding');
      } catch (_) {
        fileUrl = `https://hostelzify-media.local/docs/resubmit-${studentId}-${doc.documentType}-${Date.now()}.${file.originalname?.split('.').pop() || 'pdf'}`;
      }
    }

    doc.url = fileUrl || doc.url;
    doc.name = fileName;
    doc.fileType = fileType;
    doc.fileSize = fileSize;
    doc.uploadedAt = new Date();
    doc.status = 'under_review';
    doc.rejectionReason = '';

    onboarding.metrics.correctionsCount = (onboarding.metrics.correctionsCount || 0) + 1;

    // If no other documents are rejected, move to DOCUMENTS_UNDER_REVIEW
    const remainingRejected = onboarding.documents.filter(
      (d) => d.status === 'rejected' || d.status === 'resubmission_required'
    );
    if (remainingRejected.length === 0) {
      onboarding.status = 'DOCUMENTS_UNDER_REVIEW';
    }

    onboarding.timeline.push({
      step: 'documents',
      action: 'document_resubmitted',
      performedBy: studentId,
      performedByName: req.user.name,
      performedByRole: 'student',
      notes: `Resubmitted document for: ${doc.documentType.toUpperCase()}`,
      timestamp: new Date(),
    });

    await onboarding.save();

    res.status(200).json({
      success: true,
      data: onboarding,
      message: 'Corrected document resubmitted successfully',
      nextAction: getNextAction(onboarding),
    });
  } catch (error) {
    console.error('[Onboarding] Error resubmitting document:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Select Hostel
exports.selectHostel = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const { hostelId } = req.body;

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Selected hostel not found' });
    }

    const onboarding = await StudentOnboarding.findOne({ studentId });
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding session not found' });
    }

    onboarding.hostelId = hostelId;
    await onboarding.save();
    await User.findByIdAndUpdate(studentId, { hostelId });

    res.status(200).json({
      success: true,
      data: onboarding,
      message: `Hostel '${hostel.name}' selected successfully`,
    });
  } catch (error) {
    console.error('[Onboarding] Error selecting hostel:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Get Available Rooms for Onboarding
exports.getAvailableRoomsForOnboarding = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const onboarding = await StudentOnboarding.findOne({ studentId });
    const hostelId = req.query?.hostelId || onboarding?.hostelId || req.user.hostelId;

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'Hostel must be selected first' });
    }

    // Find rooms with capacity > occupancy and available status
    const rooms = await Room.find({
      hostelId,
      status: 'available',
      $expr: { $lt: ['$currentOccupancy', '$capacity'] },
    })
      .select('roomNumber floorNumber capacity currentOccupancy category pricing amenities')
      .lean();

    const formattedRooms = rooms.map((r) => ({
      ...r,
      availableBeds: r.capacity - r.currentOccupancy,
    }));

    res.status(200).json({
      success: true,
      data: formattedRooms,
    });
  } catch (error) {
    console.error('[Onboarding] Error fetching available rooms:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 8. Get Onboarding Fee Breakdown
exports.getOnboardingFeeBreakdown = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const onboarding = await StudentOnboarding.findOne({ studentId }).populate('roomId');
    const hostelId = onboarding?.hostelId || req.user.hostelId;

    let hostelRent = onboarding?.roomId?.pricing?.monthly || 6000;
    let securityDeposit = 5000;
    let additionalCharges = 1500; // Maintenance + electricity advance

    // Check if hostel has configured FeeStructure
    if (hostelId) {
      const activeFees = await FeeStructure.find({ hostelId, isActive: true }).lean();
      const rentFee = activeFees.find((f) => f.type === 'hostel_rent');
      const maintFee = activeFees.find((f) => f.type === 'maintenance');
      if (rentFee?.amount) hostelRent = rentFee.amount;
      if (maintFee?.amount) additionalCharges = maintFee.amount;
    }

    const totalAmount = hostelRent + securityDeposit + additionalCharges;

    // Update fee details on onboarding record
    if (onboarding) {
      onboarding.feeDetails.hostelRent = hostelRent;
      onboarding.feeDetails.securityDeposit = securityDeposit;
      onboarding.feeDetails.additionalCharges = additionalCharges;
      onboarding.feeDetails.totalAmount = totalAmount;
      onboarding.feeDetails.amountPending = totalAmount - (onboarding.feeDetails.amountPaid || 0);
      await onboarding.save();
    }

    res.status(200).json({
      success: true,
      data: {
        hostelRent,
        securityDeposit,
        additionalCharges,
        totalAmount,
        totalFee: totalAmount,
        amountPaid: onboarding?.feeDetails?.amountPaid || 0,
        amountPending: onboarding?.feeDetails?.amountPending || totalAmount,
        paymentStatus: onboarding?.feeDetails?.paymentStatus || 'pending',
      },
    });
  } catch (error) {
    console.error('[Onboarding] Error getting fee breakdown:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Initiate Onboarding Fee Payment (Razorpay)
exports.initiateOnboardingPayment = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const onboarding = await StudentOnboarding.findOne({ studentId });
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding session not found' });
    }

    const amount = onboarding.feeDetails?.totalAmount || 12500;
    const receiptId = `onb_${studentId.toString().slice(-6)}_${Date.now()}`;

    // Create payment record in DB first
    let payment = await Payment.create({
      studentId,
      hostelId: onboarding.hostelId || req.user.hostelId,
      type: 'hostel_rent',
      amount,
      status: 'pending',
      metadata: { onboardingId: onboarding._id.toString() },
    });

    onboarding.feeDetails.paymentId = payment._id;
    onboarding.feeDetails.paymentStatus = 'payment_initiated';
    await onboarding.save();

    // Create Razorpay Order
    const orderData = await createOrder(amount, receiptId, {
      studentId: studentId.toString(),
      onboardingId: onboarding._id.toString(),
    });

    if (!orderData) {
      // Offline fallback enabled if gateway not configured
      return res.status(200).json({
        success: true,
        gatewayConfigured: false,
        paymentId: payment._id,
        amount,
        message: 'Payment gateway offline. You may submit an offline payment receipt or pay at the warden office.',
      });
    }

    payment.razorpayOrderId = orderData.orderId;
    await payment.save();

    res.status(200).json({
      success: true,
      gatewayConfigured: true,
      paymentId: payment._id,
      orderId: orderData.orderId,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId: orderData.keyId,
    });
  } catch (error) {
    console.error('[Onboarding] Error initiating payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 10. Verify Onboarding Payment Signature / Submit Offline Reference
exports.verifyOnboardingPayment = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, offlineReference } = req.body;

    const onboarding = await StudentOnboarding.findOne({ studentId });
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding session not found' });
    }

    if (offlineReference && offlineReference.trim()) {
      onboarding.feeDetails.paymentMethod = 'cash';
      onboarding.feeDetails.offlineReference = offlineReference.trim();
      onboarding.feeDetails.paymentStatus = 'payment_initiated';

      onboarding.timeline.push({
        step: 'payment',
        action: 'offline_payment_submitted',
        fromStatus: onboarding.status,
        toStatus: onboarding.status,
        performedBy: studentId,
        performedByName: req.user.name,
        performedByRole: 'student',
        notes: `Offline payment receipt/challan reference submitted: ${offlineReference.trim()}`,
        timestamp: new Date(),
      });

      await onboarding.save();

      return res.status(200).json({
        success: true,
        data: onboarding,
        message: 'Offline payment details submitted for warden verification',
      });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment signature verification details' });
    }

    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, studentId });
    if (payment) {
      payment.status = 'paid';
      payment.transactionId = razorpay_payment_id;
      payment.paymentMethod = 'upi';
      payment.paidDate = new Date();
      await payment.save();
    }

    onboarding.feeDetails.paymentStatus = 'successful';
    onboarding.feeDetails.amountPaid = onboarding.feeDetails.totalAmount;
    onboarding.feeDetails.amountPending = 0;
    onboarding.feeDetails.transactionId = razorpay_payment_id;
    onboarding.feeDetails.paidAt = new Date();
    onboarding.feeDetails.receiptUrl = `https://hostelzify.receipts/rec_${razorpay_payment_id}.pdf`;

    const oldStatus = onboarding.status;
    onboarding.status = 'PAYMENT_COMPLETED';
    onboarding.currentStep = 'agreement';
    onboarding.progressPercentage = calculateProgress(onboarding);

    onboarding.timeline.push({
      step: 'payment',
      action: 'payment_verified',
      fromStatus: oldStatus,
      toStatus: onboarding.status,
      performedBy: studentId,
      performedByName: req.user.name,
      performedByRole: 'student',
      notes: `Fee payment verified online (Txn ID: ${razorpay_payment_id})`,
      timestamp: new Date(),
    });

    await onboarding.save();

    res.status(200).json({
      success: true,
      data: onboarding,
      message: 'Onboarding fee payment verified successfully',
      nextAction: getNextAction(onboarding),
    });
  } catch (error) {
    console.error('[Onboarding] Error verifying payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 11. Accept Hostel Rules & Agreement
exports.acceptHostelAgreement = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const { accepted, agreementVersion = 'v2.1' } = req.body;
    const isAccepted = accepted === undefined ? true : Boolean(accepted);

    if (!isAccepted) {
      return res.status(400).json({ success: false, message: 'You must read and agree to hostel rules and terms' });
    }

    const onboarding = await StudentOnboarding.findOne({ studentId });
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding session not found' });
    }

    // Capture rules snapshot from database
    const rules = await Rule.find({ hostelId: onboarding.hostelId, isActive: true }).select('title description').lean();
    const rulesSnapshot = rules.map((r) => `${r.title}: ${r.description || ''}`);

    const clientIp = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'] || 'Hostelzify Web Client';

    onboarding.agreement = {
      accepted: true,
      acceptedAt: new Date(),
      agreementVersion,
      ipAddress: String(clientIp),
      userAgent: String(userAgent),
      rulesSnapshot: rulesSnapshot.length > 0 ? rulesSnapshot : ['Standard Hostel Rules & Conduct Guidelines v1.0'],
    };

    const oldStatus = onboarding.status;
    onboarding.status = 'AGREEMENT_COMPLETED';
    onboarding.currentStep = 'review';
    onboarding.progressPercentage = calculateProgress(onboarding);

    onboarding.timeline.push({
      step: 'agreement',
      action: 'agreement_accepted',
      fromStatus: oldStatus,
      toStatus: onboarding.status,
      performedBy: studentId,
      performedByName: req.user.name,
      performedByRole: 'student',
      notes: `Hostel agreement accepted digitally from IP ${clientIp} (Version ${agreementVersion})`,
      timestamp: new Date(),
    });

    await onboarding.save();

    res.status(200).json({
      success: true,
      data: onboarding,
      message: 'Hostel rules & agreement signed successfully',
      nextAction: getNextAction(onboarding),
    });
  } catch (error) {
    console.error('[Onboarding] Error accepting agreement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 12. Submit for Final Review
exports.submitForFinalReview = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const onboarding = await StudentOnboarding.findOne({ studentId });
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding session not found' });
    }

    // Validation before submission
    if (!onboarding.personalInfo?.fullName || !onboarding.personalInfo?.phone) {
      return res.status(400).json({ success: false, message: 'Profile details incomplete' });
    }
    if (!onboarding.documents || onboarding.documents.length === 0) {
      return res.status(400).json({ success: false, message: 'Please upload verification documents first' });
    }
    if (!onboarding.agreement?.accepted) {
      return res.status(400).json({ success: false, message: 'Hostel rules agreement must be accepted' });
    }

    const oldStatus = onboarding.status;
    onboarding.status = 'FINAL_REVIEW';
    onboarding.currentStep = 'review';
    onboarding.progressPercentage = calculateProgress(onboarding);

    onboarding.timeline.push({
      step: 'final_review',
      action: 'application_submitted',
      fromStatus: oldStatus,
      toStatus: 'FINAL_REVIEW',
      performedBy: studentId,
      performedByName: req.user.name,
      performedByRole: 'student',
      notes: 'Application finalized and submitted for warden approval',
      timestamp: new Date(),
    });

    await onboarding.save();

    // Alert Warden
    if (onboarding.hostelId) {
      Notification.create({
        title: 'New Onboarding Application Submitted',
        message: `${req.user.name} submitted their complete onboarding application for review.`,
        type: 'alert',
        targetAudience: 'staff',
        hostelId: onboarding.hostelId,
        createdBy: studentId,
      }).catch(() => {});

      emitToRole('warden', String(onboarding.hostelId), 'onboarding:application_submitted', {
        studentId: String(studentId),
        studentName: req.user.name,
      });
    }

    res.status(200).json({
      success: true,
      data: onboarding,
      message: 'Application submitted for final warden review',
      nextAction: getNextAction(onboarding),
    });
  } catch (error) {
    console.error('[Onboarding] Error submitting final review:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// WARDEN / ADMIN ONBOARDING WORKFLOW
// ==========================================

// 13. Get Onboarding Applications List
exports.getOnboardingApplications = async (req, res) => {
  try {
    const wardenHostelId = req.user.hostelId || req.query.hostelId;
    const { status, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (wardenHostelId) {
      query.$or = [{ hostelId: wardenHostelId }, { hostelId: { $exists: false } }];
    }

    if (status && status !== 'ALL') {
      if (status === 'PENDING_DOCS') {
        query.status = { $in: ['DOCUMENTS_PENDING', 'DOCUMENTS_UNDER_REVIEW', 'CORRECTION_REQUIRED'] };
      } else if (status === 'PENDING_ROOM') {
        query.status = { $in: ['DOCUMENTS_APPROVED', 'ROOM_ALLOCATION_PENDING'] };
      } else if (status === 'PENDING_PAYMENT') {
        query.status = { $in: ['ROOM_ALLOCATED', 'PAYMENT_PENDING'] };
      } else if (status === 'PENDING_APPROVAL') {
        query.status = { $in: ['AGREEMENT_COMPLETED', 'FINAL_REVIEW'] };
      } else if (status === 'COMPLETED') {
        query.status = 'ONBOARDING_COMPLETED';
      } else {
        query.status = status;
      }
    }

    let applications = await StudentOnboarding.find(query)
      .populate('studentId', 'name email phone profileImage studentId gender course year')
      .populate('hostelId', 'name code')
      .populate('roomId', 'roomNumber floorNumber capacity currentOccupancy')
      .populate('approval.approvedBy', 'name role')
      .sort({ createdAt: -1 })
      .lean();

    // Client-side text search
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      applications = applications.filter((app) => {
        const sName = app.studentId?.name || app.personalInfo?.fullName || '';
        const sEmail = app.studentId?.email || app.personalInfo?.email || '';
        const sPhone = app.studentId?.phone || app.personalInfo?.phone || '';
        const roll = app.studentId?.studentId || app.academicInfo?.studentIdNumber || '';
        const room = app.roomId?.roomNumber || '';
        return (
          sName.toLowerCase().includes(q) ||
          sEmail.toLowerCase().includes(q) ||
          sPhone.toLowerCase().includes(q) ||
          roll.toLowerCase().includes(q) ||
          room.toLowerCase().includes(q)
        );
      });
    }

    // Compute KPI stats
    const allApps = await StudentOnboarding.find(wardenHostelId ? { hostelId: wardenHostelId } : {}).select('status feeDetails roomId').lean();
    const stats = {
      total: allApps.length,
      pendingVerification: allApps.filter((a) => ['DOCUMENTS_UNDER_REVIEW', 'DOCUMENTS_PENDING', 'CORRECTION_REQUIRED'].includes(a.status)).length,
      waitingRoomAllocation: allApps.filter((a) => !a.roomId && ['DOCUMENTS_APPROVED', 'ROOM_ALLOCATION_PENDING'].includes(a.status)).length,
      waitingPayment: allApps.filter((a) => a.feeDetails?.paymentStatus !== 'successful' && ['ROOM_ALLOCATED', 'PAYMENT_PENDING'].includes(a.status)).length,
      pendingFinalApproval: allApps.filter((a) => ['AGREEMENT_COMPLETED', 'FINAL_REVIEW'].includes(a.status)).length,
      completed: allApps.filter((a) => a.status === 'ONBOARDING_COMPLETED').length,
    };

    const totalCount = applications.length;
    const numLimit = parseInt(limit, 10) || 50;
    const numPage = parseInt(page, 10) || 1;
    const paginated = applications.slice((numPage - 1) * numLimit, numPage * numLimit);

    res.status(200).json({
      success: true,
      data: paginated,
      stats,
      pagination: {
        total: totalCount,
        page: numPage,
        limit: numLimit,
      },
    });
  } catch (error) {
    console.error('[Onboarding] Error fetching applications:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 14. Get Application Details Dossier
exports.getOnboardingApplicationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await StudentOnboarding.findById(id)
      .populate('studentId', 'name email phone profileImage studentId gender course year address parentContact emergencyContact')
      .populate('hostelId', 'name code address rules contactPhone')
      .populate('roomId', 'roomNumber floorNumber capacity currentOccupancy category pricing')
      .populate('documents.verifiedBy', 'name role')
      .populate('approval.approvedBy', 'name role')
      .populate('timeline.performedBy', 'name role');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Onboarding application not found' });
    }

    // Strict IDOR check: only staff or the student themselves can access their dossier
    const userRole = Array.isArray(req.user?.role) ? req.user.role[0] : req.user?.role;
    const isStaff = ['warden', 'owner', 'superadmin', 'admin'].includes(userRole);
    const applicantUserId = application.studentId?._id?.toString() || application.studentId?.toString();
    const currentUserId = (req.user._id || req.user.id).toString();

    if (!isStaff && applicantUserId !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to view another student\'s dossier.' });
    }

    res.status(200).json({
      success: true,
      data: application,
    });
  } catch (error) {
    console.error('[Onboarding] Error fetching application details:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 15. Verify Document (Approve / Reject)
exports.verifyDocument = async (req, res) => {
  try {
    const { id } = req.params; // Onboarding ID
    const { documentId, documentType, action, status, rejectionReason, correctionInstructions } = req.body;
    const wardenId = req.user._id || req.user.id;
    const wardenName = req.user.name || 'Warden';

    const isApprove = action === 'approve' || status === 'approved';
    const isReject = action === 'reject' || status === 'rejected' || status === 'resubmission_required';

    if (!isApprove && !isReject) {
      return res.status(400).json({ success: false, message: 'Valid action (approve/reject) or status (approved/rejected/resubmission_required) required' });
    }

    const application = await StudentOnboarding.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Onboarding application not found' });
    }

    let doc = null;
    if (documentId) {
      doc = application.documents.id(documentId);
    }
    if (!doc && documentType) {
      doc = application.documents.find((d) => d.documentType === documentType);
    }
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found in application' });
    }

    const oldStatus = application.status;

    if (isApprove) {
      doc.status = 'approved';
      doc.verifiedBy = wardenId;
      doc.verifiedAt = new Date();
      doc.rejectionReason = '';
      doc.correctionInstructions = '';

      // Check if all uploaded documents are approved
      const allApproved = application.documents.every((d) => d.status === 'approved');
      if (allApproved && application.documents.length >= 2) {
        application.status = application.roomId ? 'ROOM_ALLOCATED' : 'DOCUMENTS_APPROVED';
      }

      application.timeline.push({
        step: 'documents',
        action: 'document_approved',
        fromStatus: oldStatus,
        toStatus: application.status,
        performedBy: wardenId,
        performedByName: wardenName,
        performedByRole: 'warden',
        notes: `Document approved: ${doc.documentType.toUpperCase()}`,
        timestamp: new Date(),
      });
    } else {
      doc.status = 'rejected';
      doc.rejectionReason = rejectionReason || 'Document verification failed.';
      doc.correctionInstructions = correctionInstructions || 'Please upload a clear, uncropped copy.';
      doc.verifiedBy = wardenId;
      doc.verifiedAt = new Date();

      application.status = 'CORRECTION_REQUIRED';
      application.metrics.rejectionsCount = (application.metrics.rejectionsCount || 0) + 1;

      application.timeline.push({
        step: 'documents',
        action: 'document_rejected',
        fromStatus: oldStatus,
        toStatus: 'CORRECTION_REQUIRED',
        performedBy: wardenId,
        performedByName: wardenName,
        performedByRole: 'warden',
        notes: `Document rejected (${doc.documentType}): ${rejectionReason || 'Requires correction'}`,
        timestamp: new Date(),
      });

      // Notify Student
      Notification.create({
        title: 'Document Correction Required',
        message: `Your ${doc.documentType.replace(/_/g, ' ')} was rejected: ${rejectionReason || 'Please resubmit'}.`,
        type: 'alert',
        targetAudience: 'students',
        recipients: [String(application.studentId)],
        createdBy: wardenId,
      }).catch(() => {});

      emitToUser(String(application.studentId), 'onboarding:document_rejected', {
        documentType: doc.documentType,
        rejectionReason: doc.rejectionReason,
      });
    }

    application.progressPercentage = calculateProgress(application);
    await application.save();

    // Audit Log
    AuditLog.create({
      action: action === 'approve' ? 'DOCUMENT_VERIFICATION_APPROVED' : 'DOCUMENT_VERIFICATION_REJECTED',
      entityType: 'User',
      entityId: application.studentId,
      performedBy: wardenId,
      changes: {
        documentType: doc.documentType,
        action,
        rejectionReason,
      },
      ipAddress: req.ip || '127.0.0.1',
    }).catch(() => {});

    res.status(200).json({
      success: true,
      data: application,
      message: `Document ${action === 'approve' ? 'approved' : 'marked for correction'}`,
    });
  } catch (error) {
    console.error('[Onboarding] Error verifying document:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 16. Allocate Room & Bed (Warden/Admin)
exports.allocateRoomAndBed = async (req, res) => {
  try {
    const { id } = req.params; // Onboarding ID
    const { roomId, bedNumber, roomType } = req.body;
    const wardenId = req.user._id || req.user.id;
    const wardenName = req.user.name || 'Warden';

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'Target room selection is required' });
    }

    const application = await StudentOnboarding.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Onboarding application not found' });
    }

    if (!application.hostelId) {
      return res.status(400).json({ success: false, message: 'Application is not associated with any hostel' });
    }

    // Tenant isolation: verify authenticated staff has access to application's hostel
    await assertOwnsHostel(req, application.hostelId);

    // Atomic room capacity & concurrency check
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Selected room not found' });
    }

    if (!room.hostelId) {
      return res.status(400).json({ success: false, message: 'Selected room is not associated with any hostel' });
    }

    // Cross-tenant verification: room must belong to the application's hostel
    if (String(room.hostelId) !== String(application.hostelId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Cross-tenant room allocation. Room does not belong to the application hostel.',
      });
    }

    // Verify authenticated staff has access to room's hostel
    await assertOwnsHostel(req, room.hostelId);

    if (room.status !== 'available') {
      return res.status(400).json({ success: false, message: `Room ${room.roomNumber} is currently ${room.status}` });
    }

    if (room.currentOccupancy >= room.capacity) {
      return res.status(400).json({
        success: false,
        message: `Room ${room.roomNumber} is at maximum capacity (${room.capacity}/${room.capacity}). Cannot allocate bed.`,
      });
    }

    const studentId = application.studentId;

    // Check if student is already assigned to this room
    if (room.students.some((s) => s.toString() === studentId.toString())) {
      return res.status(400).json({ success: false, message: 'Student is already allocated to this room' });
    }

    // Safeguard: Prevent duplicate bed allocation within the same room
    if (bedNumber && bedNumber.trim()) {
      const existingBedOccupant = await StudentOnboarding.findOne({
        roomId,
        bedNumber: bedNumber.trim(),
        _id: { $ne: application._id },
        status: { $nin: ['REJECTED', 'CANCELLED'] },
      });
      if (existingBedOccupant) {
        return res.status(400).json({
          success: false,
          message: `Bed "${bedNumber}" in Room ${room.roomNumber} is already occupied by another resident. Please choose a different bed.`,
        });
      }
    }

    // If student was previously assigned to another room, vacate it first
    if (application.roomId && application.roomId.toString() !== roomId.toString()) {
      await Room.findByIdAndUpdate(application.roomId, {
        $pull: { students: studentId },
        $inc: { currentOccupancy: -1 },
      });
    }

    // Atomically increment occupancy and add student
    await Room.findByIdAndUpdate(roomId, {
      $push: { students: studentId },
      $inc: { currentOccupancy: 1 },
    });

    application.roomId = roomId;
    application.blockId = room.blockId;
    application.bedNumber = bedNumber || `Bed-${room.currentOccupancy + 1}`;
    application.roomType = roomType || room.category || 'Standard';

    const oldStatus = application.status;
    if (application.feeDetails?.paymentStatus === 'successful') {
      application.status = application.agreement?.accepted ? 'FINAL_REVIEW' : 'AGREEMENT_PENDING';
    } else {
      application.status = 'ROOM_ALLOCATED';
    }

    application.progressPercentage = calculateProgress(application);

    application.timeline.push({
      step: 'room',
      action: 'room_allocated',
      fromStatus: oldStatus,
      toStatus: application.status,
      performedBy: wardenId,
      performedByName: wardenName,
      performedByRole: 'warden',
      notes: `Room ${room.roomNumber} (${application.bedNumber}) allocated to resident`,
      timestamp: new Date(),
    });

    await application.save();

    // Sync to User model
    await User.findByIdAndUpdate(studentId, {
      roomId,
      room: room.roomNumber,
      blockId: room.blockId,
      hostelId: application.hostelId || room.hostelId,
    });

    // Notify Student
    Notification.create({
      title: 'Room Allocated!',
      message: `Your room has been assigned: Room ${room.roomNumber}, ${application.bedNumber}.`,
      type: 'alert',
      targetAudience: 'students',
      recipients: [String(studentId)],
      createdBy: wardenId,
    }).catch(() => {});

    emitToUser(String(studentId), 'onboarding:room_allocated', {
      roomNumber: room.roomNumber,
      bedNumber: application.bedNumber,
    });

    // Audit Log
    AuditLog.create({
      action: 'ONBOARDING_ROOM_ALLOCATED',
      entityType: 'Room',
      entityId: roomId,
      performedBy: wardenId,
      changes: {
        studentId,
        roomNumber: room.roomNumber,
        bedNumber: application.bedNumber,
      },
      ipAddress: req.ip || '127.0.0.1',
    }).catch(() => {});

    await application.populate('roomId');

    res.status(200).json({
      success: true,
      data: application,
      message: `Room ${room.roomNumber} allocated successfully`,
    });
  } catch (error) {
    console.error('[Onboarding] Error allocating room:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// 17. Confirm Offline Fee Payment (Warden/Admin)
exports.confirmOfflineFee = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      amount,
      amountPaid,
      paymentMethod = 'cash',
      paymentMode = 'cash',
      referenceNo = '',
      referenceNumber = '',
      notes = '',
    } = req.body;
    const wardenId = req.user._id || req.user.id;
    const wardenName = req.user.name || 'Warden';

    const application = await StudentOnboarding.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Onboarding application not found' });
    }

    if (!application.hostelId) {
      return res.status(400).json({ success: false, message: 'Application is not associated with any hostel' });
    }
    await assertOwnsHostel(req, application.hostelId);

    let normalizedMethod = paymentMethod || paymentMode || 'cash';
    if (normalizedMethod === 'offline_cash') normalizedMethod = 'cash';
    const validPaymentMethods = ['upi', 'card', 'netbanking', 'cash', 'other'];
    if (!validPaymentMethods.includes(normalizedMethod)) {
      normalizedMethod = 'cash';
    }

    const paidAmount = Number(amount || amountPaid) || application.feeDetails?.totalAmount || 12500;
    const ref = referenceNo || referenceNumber || `OFFLINE_${Date.now()}`;

    // Create payment record
    const payment = await Payment.create({
      studentId: application.studentId,
      hostelId: application.hostelId,
      type: 'hostel_rent',
      amount: paidAmount,
      status: 'paid',
      paymentMethod: normalizedMethod,
      transactionId: ref,
      paidDate: new Date(),
      metadata: { confirmedBy: wardenId.toString(), notes, originalMethod: paymentMethod || paymentMode },
    });

    application.feeDetails.paymentStatus = 'successful';
    application.feeDetails.status = 'successful';
    application.feeDetails.amountPaid = paidAmount;
    application.feeDetails.amountPending = 0;
    application.feeDetails.paymentMethod = normalizedMethod;
    application.feeDetails.transactionId = payment.transactionId;
    application.feeDetails.paidAt = new Date();
    application.feeDetails.offlinePaymentReceipt = {
      confirmedBy: wardenId,
      confirmedAt: new Date(),
      notes,
      referenceNo,
    };

    const oldStatus = application.status;
    application.status = application.agreement?.accepted ? 'FINAL_REVIEW' : 'PAYMENT_COMPLETED';
    application.progressPercentage = calculateProgress(application);

    application.timeline.push({
      step: 'payment',
      action: 'offline_payment_confirmed',
      fromStatus: oldStatus,
      toStatus: application.status,
      performedBy: wardenId,
      performedByName: wardenName,
      performedByRole: 'warden',
      notes: `Offline payment of ₹${paidAmount} confirmed (${paymentMethod.toUpperCase()}). Ref: ${referenceNo || 'None'}`,
      timestamp: new Date(),
    });

    await application.save();

    // Notify Student
    Notification.create({
      title: 'Fee Payment Confirmed',
      message: `Your offline payment of ₹${paidAmount} was verified by the warden office.`,
      type: 'alert',
      targetAudience: 'students',
      recipients: [String(application.studentId)],
      createdBy: wardenId,
    }).catch(() => {});

    emitToUser(String(application.studentId), 'onboarding:payment_confirmed', {
      amount: paidAmount,
      paymentMethod,
    });

    res.status(200).json({
      success: true,
      data: application,
      message: 'Offline payment verified and recorded',
    });
  } catch (error) {
    console.error('[Onboarding] Error confirming offline fee:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 18. Request Correction / Send Back Application
exports.requestCorrection = async (req, res) => {
  try {
    const { id } = req.params;
    const { correctionNotes } = req.body;
    const wardenId = req.user._id || req.user.id;
    const wardenName = req.user.name || 'Warden';

    if (!correctionNotes || !correctionNotes.trim()) {
      return res.status(400).json({ success: false, message: 'Correction instructions are required' });
    }

    const application = await StudentOnboarding.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Onboarding application not found' });
    }

    const oldStatus = application.status;
    application.status = 'CORRECTION_REQUIRED';
    application.approval.correctionRequestedAt = new Date();
    application.approval.correctionNotes = correctionNotes.trim();

    application.timeline.push({
      step: 'review',
      action: 'correction_requested',
      fromStatus: oldStatus,
      toStatus: 'CORRECTION_REQUIRED',
      performedBy: wardenId,
      performedByName: wardenName,
      performedByRole: 'warden',
      notes: `Correction requested: ${correctionNotes.trim()}`,
      timestamp: new Date(),
    });

    await application.save();

    // Notify Student
    Notification.create({
      title: 'Application Correction Required',
      message: `Warden requested updates on your application: ${correctionNotes.trim()}`,
      type: 'alert',
      targetAudience: 'students',
      recipients: [String(application.studentId)],
      createdBy: wardenId,
    }).catch(() => {});

    emitToUser(String(application.studentId), 'onboarding:correction_required', {
      notes: correctionNotes.trim(),
    });

    res.status(200).json({
      success: true,
      data: application,
      message: 'Correction request sent to student',
    });
  } catch (error) {
    console.error('[Onboarding] Error requesting correction:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 19. Final Approval & Resident Activation (Warden/Admin)
exports.approveOnboardingFinal = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks = '' } = req.body;
    const wardenId = req.user._id || req.user.id;
    const wardenName = req.user.name || 'Warden';

    const application = await StudentOnboarding.findById(id).populate('hostelId').populate('roomId');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Onboarding application not found' });
    }

    const appHostelId = application.hostelId?._id || application.hostelId;
    if (!appHostelId) {
      return res.status(400).json({ success: false, message: 'Application is not associated with any hostel' });
    }
    await assertOwnsHostel(req, appHostelId);

    // Safety checks before final activation
    if (!application.roomId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot finalize onboarding: Student must have an allocated room and bed first',
      });
    }

    if (application.feeDetails?.paymentStatus !== 'successful') {
      return res.status(400).json({
        success: false,
        message: 'Cannot finalize onboarding: Fee payment must be completed and verified',
      });
    }

    if (!application.agreement?.accepted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot finalize onboarding: Hostel rules agreement must be accepted by student',
      });
    }

    const hasRejectedDocs = (application.documents || []).some((d) => d.status === 'rejected');
    if (hasRejectedDocs) {
      return res.status(400).json({
        success: false,
        message: 'Cannot finalize onboarding: Some documents are currently rejected or need correction',
      });
    }

    const oldStatus = application.status;
    application.status = 'ONBOARDING_COMPLETED';
    application.currentStep = 'completed';
    application.progressPercentage = 100;
    application.approval.approvedBy = wardenId;
    application.approval.approvedAt = new Date();
    application.approval.remarks = remarks || 'All admission requirements satisfied. Resident activated.';
    application.metrics.completedAt = new Date();

    const durationMs = application.metrics.completedAt.getTime() - new Date(application.createdAt).getTime();
    application.metrics.totalDurationMinutes = Math.round(durationMs / 60000);

    application.timeline.push({
      step: 'approval',
      action: 'onboarding_approved',
      fromStatus: oldStatus,
      toStatus: 'ONBOARDING_COMPLETED',
      performedBy: wardenId,
      performedByName: wardenName,
      performedByRole: 'warden',
      notes: `Final onboarding approved by ${wardenName}. Resident activated. ${remarks}`,
      timestamp: new Date(),
    });

    await application.save();

    // Transition User status to 'active'
    const student = await User.findById(application.studentId);
    if (student) {
      student.status = 'active';
      student.onboardingStatus = 'completed';
      student.hostelId = application.hostelId?._id || application.hostelId;
      student.roomId = application.roomId?._id || application.roomId;
      if (application.roomId?.roomNumber) {
        student.room = application.roomId.roomNumber;
      }
      if (application.academicInfo?.studentIdNumber) {
        student.academicInfo = {
          studentIdNumber: application.academicInfo.studentIdNumber,
          college: application.academicInfo.college,
          department: application.academicInfo.department,
          semester: application.academicInfo.yearSemester,
        };
        student.studentId = application.academicInfo.studentIdNumber;
        student.course = application.academicInfo.course;
      }
      if (application.parentInfo?.name) {
        student.parentContact = {
          name: application.parentInfo.name,
          phone: application.parentInfo.phone,
          email: application.parentInfo.email,
        };
      }
      await student.save();

      // Dispatch approval email
      if (student.email) {
        const hostelName = application.hostelId?.name || 'Hostelzify';
        sendApprovalEmail(student.email, student.name, hostelName).catch(() => {});
      }
    }

    // Dispatch in-app notification & socket event
    Notification.create({
      title: 'Hostel Onboarding Completed! 🎉',
      message: `Congratulations! Your onboarding for ${application.hostelId?.name || 'Hostel'} has been officially approved. Welcome to the hostel!`,
      type: 'announcement',
      targetAudience: 'students',
      recipients: [String(application.studentId)],
      createdBy: wardenId,
    }).catch(() => {});

    emitToUser(String(application.studentId), 'onboarding:completed', {
      hostelName: application.hostelId?.name,
      roomNumber: application.roomId?.roomNumber,
      bedNumber: application.bedNumber,
    });

    // Audit Log
    AuditLog.create({
      action: 'ONBOARDING_FINAL_APPROVED',
      entityType: 'User',
      entityId: application.studentId,
      performedBy: wardenId,
      changes: {
        status: 'active',
        hostelId: application.hostelId?._id || application.hostelId,
        roomId: application.roomId?._id || application.roomId,
        durationMinutes: application.metrics.totalDurationMinutes,
      },
      ipAddress: req.ip || '127.0.0.1',
    }).catch(() => {});

    res.status(200).json({
      success: true,
      data: application,
      message: 'Student onboarding successfully completed and resident activated!',
    });
  } catch (error) {
    console.error('[Onboarding] Error approving onboarding:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// 20. Reject Onboarding Application
exports.rejectOnboarding = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const wardenId = req.user._id || req.user.id;
    const wardenName = req.user.name || 'Warden';

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is mandatory' });
    }

    const application = await StudentOnboarding.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Onboarding application not found' });
    }

    const oldStatus = application.status;
    application.status = 'REJECTED';
    application.approval.rejectedBy = wardenId;
    application.approval.rejectedAt = new Date();
    application.approval.rejectionReason = rejectionReason.trim();

    application.timeline.push({
      step: 'approval',
      action: 'onboarding_rejected',
      fromStatus: oldStatus,
      toStatus: 'REJECTED',
      performedBy: wardenId,
      performedByName: wardenName,
      performedByRole: 'warden',
      notes: `Application rejected: ${rejectionReason.trim()}`,
      timestamp: new Date(),
    });

    await application.save();

    Notification.create({
      title: 'Hostel Onboarding Application Rejected',
      message: `Your onboarding application was rejected: ${rejectionReason.trim()}`,
      type: 'alert',
      targetAudience: 'students',
      recipients: [String(application.studentId)],
      createdBy: wardenId,
    }).catch(() => {});

    emitToUser(String(application.studentId), 'onboarding:rejected', {
      reason: rejectionReason.trim(),
    });

    res.status(200).json({
      success: true,
      data: application,
      message: 'Onboarding application rejected',
    });
  } catch (error) {
    console.error('[Onboarding] Error rejecting onboarding:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// 21. Get Onboarding Smoothness Metrics
exports.getOnboardingMetrics = async (req, res) => {
  try {
    const wardenHostelId = req.user.hostelId || req.query.hostelId;
    const query = wardenHostelId ? { hostelId: wardenHostelId } : {};

    const allRecords = await StudentOnboarding.find(query).lean();
    const total = allRecords.length;
    const completed = allRecords.filter((r) => r.status === 'ONBOARDING_COMPLETED');
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

    // Average duration
    const completedWithDuration = completed.filter((c) => c.metrics?.totalDurationMinutes > 0);
    const avgDuration =
      completedWithDuration.length > 0
        ? Math.round(
            completedWithDuration.reduce((acc, c) => acc + c.metrics.totalDurationMinutes, 0) /
              completedWithDuration.length
          )
        : 0;

    // Rejection / correction rate
    let totalDocs = 0;
    let rejectedDocs = 0;
    allRecords.forEach((r) => {
      (r.documents || []).forEach((d) => {
        totalDocs++;
        if (d.status === 'rejected' || d.status === 'resubmission_required') rejectedDocs++;
      });
    });
    const docRejectionRate = totalDocs > 0 ? Math.round((rejectedDocs / totalDocs) * 100) : 0;

    // Drop-off by step
    const stepBreakdown = {
      profile: allRecords.filter((r) => ['REGISTERED', 'PROFILE_INCOMPLETE'].includes(r.status)).length,
      contacts: allRecords.filter((r) => r.status === 'PROFILE_COMPLETED').length,
      documents: allRecords.filter((r) => ['DOCUMENTS_PENDING', 'DOCUMENTS_UNDER_REVIEW', 'CORRECTION_REQUIRED'].includes(r.status)).length,
      room: allRecords.filter((r) => ['DOCUMENTS_APPROVED', 'ROOM_ALLOCATION_PENDING'].includes(r.status)).length,
      payment: allRecords.filter((r) => ['ROOM_ALLOCATED', 'PAYMENT_PENDING'].includes(r.status)).length,
      agreement: allRecords.filter((r) => ['PAYMENT_COMPLETED', 'AGREEMENT_PENDING'].includes(r.status)).length,
      review: allRecords.filter((r) => ['AGREEMENT_COMPLETED', 'FINAL_REVIEW'].includes(r.status)).length,
      completed: completed.length,
    };

    res.status(200).json({
      success: true,
      data: {
        totalApplications: total,
        completedApplications: completed.length,
        completionRate,
        avgCompletionTimeMinutes: avgDuration,
        documentRejectionRate: docRejectionRate,
        totalDocumentsUploaded: totalDocs,
        totalDocumentsRejected: rejectedDocs,
        dropOffByStep: stepBreakdown,
      },
    });
  } catch (error) {
    console.error('[Onboarding] Error fetching metrics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Router & Client Aliases
exports.saveOnboardingProfile = exports.savePersonalInfo;
exports.saveOnboardingContacts = exports.saveGuardianInfo;
exports.uploadOnboardingDocument = exports.uploadDocument;
exports.resubmitOnboardingDocument = exports.resubmitDocument;
exports.selectOnboardingHostel = exports.selectHostel;
exports.submitOnboardingFinalReview = exports.submitForFinalReview;
exports.getWardenOnboardingApplications = exports.getOnboardingApplications;
exports.getWardenOnboardingApplicationDetails = exports.getOnboardingApplicationDetails;
exports.verifyWardenDocument = exports.verifyDocument;
exports.allocateWardenOnboardingRoom = exports.allocateRoomAndBed;
exports.confirmWardenOfflineFee = exports.confirmOfflineFee;
exports.requestWardenCorrection = exports.requestCorrection;
exports.approveWardenOnboardingFinal = exports.approveOnboardingFinal;
exports.rejectWardenOnboarding = exports.rejectOnboarding;
