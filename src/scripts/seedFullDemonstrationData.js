/**
 * @file seedFullDemonstrationData.js
 * @description Comprehensive demonstration data seeder for Hostel Management System.
 * Populates interconnected, realistic sample data for rooms, students, staff,
 * maintenance, complaints, violations, finance/payments, gate logs, and geofencing.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Complaint = require('../models/Complaint');
const Violation = require('../models/Violation');
const Payment = require('../models/Payment');
const Plan = require('../models/Plan');
const GateEvent = require('../models/GateEvent');
const GeoFence = require('../models/GeoFence');
const Attendance = require('../models/Attendance');
const StudentLocation = require('../models/StudentLocation');

async function seedData() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not defined in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB successfully.');

  // 1. Locate Owner
  const owner = await User.findOne({ email: 'panil9153@gmail.com' });
  if (!owner) {
    console.error('Owner panil9153@gmail.com not found!');
    process.exit(1);
  }
  console.log(`Found owner: ${owner.name} (${owner._id})`);

  // 2. Locate or create active Hostel
  let hostel = await Hostel.findOne({ ownerId: owner._id });
  if (!hostel) {
    hostel = await Hostel.findOne({});
  }

  if (!hostel) {
    console.log('Creating demo hostel...');
    hostel = await Hostel.create({
      name: 'Jai Hind girls hostel',
      ownerId: owner._id,
      address: {
        street: '124, College Road, Near University Gate',
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        pincode: '462001',
        coordinates: { latitude: 23.5235, longitude: 77.8139 },
      },
      location: {
        type: 'Point',
        coordinates: [77.8139, 23.5235],
      },
      capacity: 120,
      contact: {
        phone: '9823100001',
        email: 'info@jaihindhostel.com',
        managerName: 'Rajesh Sharma',
        managerPhone: '9823100002',
      },
      rules: {
        curfewTime: '22:00',
        weekendCurfewTime: '23:00',
        curfewEndTime: '06:00',
        gracePeriodMinutes: 15,
        visitorAllowed: true,
        visitorEndTime: '19:00',
      },
      facilities: {
        security: true,
        cctv: true,
        powerBackup: true,
        waterSupply: true,
        lift: true,
        fireSafety: true,
      },
      amenities: {
        wifi: true,
        laundry: true,
        mess: true,
        gym: true,
        parking: true,
      },
    });
  } else {
    // Ensure coordinates are set properly
    hostel.address = hostel.address || {};
    hostel.address.coordinates = { latitude: 23.5235, longitude: 77.8139 };
    hostel.location = { type: 'Point', coordinates: [77.8139, 23.5235] };
    await hostel.save();
  }
  console.log(`Using hostel: "${hostel.name}" (${hostel._id})`);

  const hostelId = hostel._id;
  const hostelLat = 23.5235;
  const hostelLng = 77.8139;

  // 3. Seed Rooms
  console.log('Seeding rooms...');
  const roomTemplates = [
    { roomNumber: '101', floorNumber: 1, capacity: 2, category: 'AC', pricing: { monthly: 12000 } },
    { roomNumber: '102', floorNumber: 1, capacity: 2, category: 'AC', pricing: { monthly: 12000 } },
    { roomNumber: '103', floorNumber: 1, capacity: 2, category: 'Non-AC', pricing: { monthly: 8500 } },
    { roomNumber: '104', floorNumber: 1, capacity: 2, category: 'Non-AC', pricing: { monthly: 8500 } },
    { roomNumber: '201', floorNumber: 2, capacity: 3, category: 'Deluxe', pricing: { monthly: 15000 } },
    { roomNumber: '202', floorNumber: 2, capacity: 3, category: 'Standard', pricing: { monthly: 9500 } },
    { roomNumber: '203', floorNumber: 2, capacity: 1, category: 'Deluxe', pricing: { monthly: 18000 } },
    { roomNumber: '301', floorNumber: 3, capacity: 2, category: 'Standard', pricing: { monthly: 9000 } },
  ];

  const seededRooms = [];
  for (const r of roomTemplates) {
    let room = await Room.findOne({ hostelId, roomNumber: r.roomNumber });
    if (!room) {
      room = await Room.create({
        ...r,
        hostelId,
        status: 'available',
        currentOccupancy: 0,
        students: [],
      });
    } else {
      room.capacity = r.capacity;
      room.category = r.category;
      room.pricing = r.pricing;
      await room.save();
    }
    seededRooms.push(room);
  }
  console.log(`Seeded ${seededRooms.length} rooms.`);

  // 4. Seed Staff Members
  console.log('Seeding staff profiles...');
  const staffData = [
    { name: 'Ramesh Kumar', email: 'warden.ramesh@example.com', phone: '9823109901', role: 'warden' },
    { name: 'Bahadur Singh', email: 'security.bahadur@example.com', phone: '9823109902', role: 'security' },
    { name: 'Sunita Devi', email: 'cleaner.sunita@example.com', phone: '9823109903', role: 'cleaner' },
  ];

  const seededStaff = [];
  const defaultPasswordHash = await bcrypt.hash('Test@123', 10);

  for (const s of staffData) {
    let staffUser = await User.findOne({ email: s.email });
    if (!staffUser) {
      staffUser = await User.create({
        name: s.name,
        email: s.email,
        password: defaultPasswordHash,
        phone: s.phone,
        role: s.role,
        status: 'active',
        hostelId,
      });
    } else {
      staffUser.hostelId = hostelId;
      staffUser.status = 'active';
      await staffUser.save();
    }
    seededStaff.push(staffUser);
  }
  console.log(`Seeded ${seededStaff.length} staff members.`);

  // 5. Seed Students with Room Allocation
  console.log('Seeding students and room allocations...');
  const studentProfiles = [
    { name: 'Aarav Sharma', email: 'aarav.sharma@example.com', phone: '9823101101', studentId: 'STU-2024-001', roomIdx: 0, isInside: true },
    { name: 'Pooja Verma', email: 'pooja.verma@example.com', phone: '9823101102', studentId: 'STU-2024-002', roomIdx: 0, isInside: true },
    { name: 'Rohan Mehta', email: 'rohan.mehta@example.com', phone: '9823101103', studentId: 'STU-2024-003', roomIdx: 1, isInside: true },
    { name: 'Sneha Kulkarni', email: 'sneha.kulkarni@example.com', phone: '9823101104', studentId: 'STU-2024-004', roomIdx: 1, isInside: true },
    { name: 'Vikram Rathore', email: 'vikram.rathore@example.com', phone: '9823101105', studentId: 'STU-2024-005', roomIdx: 2, isInside: false },
    { name: 'Divya Patel', email: 'divya.patel@example.com', phone: '9823101106', studentId: 'STU-2024-006', roomIdx: 4, isInside: true },
    { name: 'Ananya Deshmukh', email: 'ananya.deshmukh@example.com', phone: '9823101107', studentId: 'STU-2024-007', roomIdx: 4, isInside: true },
    { name: 'Karan Singhania', email: 'karan.singhania@example.com', phone: '9823101108', studentId: 'STU-2024-008', roomIdx: 6, isInside: false },
  ];

  // Reset room occupancy arrays
  for (const r of seededRooms) {
    r.students = [];
    r.currentOccupancy = 0;
  }

  const seededStudents = [];
  const now = new Date();

  for (let i = 0; i < studentProfiles.length; i++) {
    const sp = studentProfiles[i];
    const targetRoom = seededRooms[sp.roomIdx];

    // GPS location: if inside, within ~25m; if outside, ~1.4km away
    const lat = sp.isInside ? hostelLat + (i * 0.0001) : hostelLat + 0.013;
    const lng = sp.isInside ? hostelLng + (i * 0.0001) : hostelLng + 0.013;

    let student = await User.findOne({ email: sp.email });
    if (!student) {
      student = await User.create({
        name: sp.name,
        email: sp.email,
        password: defaultPasswordHash,
        phone: sp.phone,
        studentId: sp.studentId,
        role: 'student',
        status: 'active',
        hostelId,
        roomId: targetRoom._id,
        currentLocation: {
          latitude: lat,
          longitude: lng,
          accuracy: 8,
          timestamp: now,
        },
        lastLocationUpdate: now,
        locationPermissionStatus: 'granted',
        parentContact: {
          name: `Mr. ${sp.name.split(' ')[1]} Senior`,
          phone: `982319${1000 + i}`,
          relation: 'Father',
          email: `parent.${sp.email}`,
        },
        emergencyContact: {
          name: `Mrs. ${sp.name.split(' ')[1]}`,
          phone: `982318${1000 + i}`,
          relation: 'Mother',
        },
      });
    } else {
      student.hostelId = hostelId;
      student.roomId = targetRoom._id;
      student.currentLocation = {
        latitude: lat,
        longitude: lng,
        accuracy: 8,
        timestamp: now,
      };
      student.lastLocationUpdate = now;
      student.locationPermissionStatus = 'granted';
      student.parentContact = student.parentContact || {
        name: `Mr. ${sp.name.split(' ')[1]} Senior`,
        phone: `982319${1000 + i}`,
        relation: 'Father',
      };
      await student.save();
    }

    // Add to room occupants
    targetRoom.students.push(student._id);
    targetRoom.currentOccupancy = targetRoom.students.length;
    targetRoom.status = targetRoom.currentOccupancy >= targetRoom.capacity ? 'occupied' : 'available';

    seededStudents.push(student);
  }

  // Save updated room occupancies
  for (const r of seededRooms) {
    await r.save();
  }
  console.log(`Seeded ${seededStudents.length} students allocated to rooms.`);

  // 6. Seed Plans for Hostel
  console.log('Seeding plans...');
  const planDefs = [
    { name: '1 Month Standard Stay', durationMonths: 1, amount: 12000 },
    { name: '3 Months Semester Pass', durationMonths: 3, amount: 34000 },
    { name: '6 Months Academic Year', durationMonths: 6, amount: 65000 },
  ];

  const seededPlans = [];
  for (const pd of planDefs) {
    let plan = await Plan.findOne({ hostelId, name: pd.name });
    if (!plan) {
      plan = await Plan.create({ ...pd, hostelId, isActive: true });
    }
    seededPlans.push(plan);
  }

  // 7. Seed Financial Payments & Invoices
  console.log('Seeding financial payments & dues...');
  await Payment.deleteMany({ hostelId });

  const paymentMethods = ['upi', 'netbanking', 'cash'];
  for (let i = 0; i < seededStudents.length; i++) {
    const student = seededStudents[i];
    const isPaid = i < 6; // 6 paid, 2 pending
    const plan = seededPlans[i % seededPlans.length];

    await Payment.create({
      studentId: student._id,
      hostelId,
      planId: plan._id,
      type: 'hostel_rent',
      amount: plan.amount || 12000,
      status: isPaid ? 'paid' : 'pending',
      paymentMethod: isPaid ? paymentMethods[i % paymentMethods.length] : undefined,
      transactionId: isPaid ? `TXN-DEMO-${Date.now()}-${i}` : undefined,
      invoiceId: `INV-2024-${1000 + i}`,
      dueDate: new Date(Date.now() + (isPaid ? -15 : 5) * 86400000),
      paidDate: isPaid ? new Date(Date.now() - (15 - i) * 86400000) : null,
      periodStart: new Date(Date.now() - 30 * 86400000),
      periodEnd: new Date(Date.now() + 30 * 86400000),
    });
  }
  console.log(`Seeded 8 financial payments (6 completed, 2 pending).`);

  // 8. Seed Maintenance Complaints & General Complaints
  console.log('Seeding maintenance orders and resident complaints...');
  await Complaint.deleteMany({ hostelId });

  const complaintsData = [
    {
      title: 'AC unit cooling low in Room 101',
      description: 'The split AC in room 101 is not cooling effectively even at 18 degrees. Needs filter cleaning and gas pressure check.',
      complaintType: 'maintenance',
      category: 'electrical',
      priority: 'high',
      status: 'in-progress',
      studentIdx: 0,
      roomIdx: 0,
      assignedStaffIdx: 0, // warden
    },
    {
      title: 'Bathroom tap leak Floor 2',
      description: 'Continuous dripping from the main washbasin faucet in room 202 causing water wastage.',
      complaintType: 'maintenance',
      category: 'plumbing',
      priority: 'medium',
      status: 'assigned',
      studentIdx: 3,
      roomIdx: 5,
      assignedStaffIdx: 0,
    },
    {
      title: 'Study chair weld detached',
      description: 'One of the study chairs in room 103 has a loose backrest frame.',
      complaintType: 'maintenance',
      category: 'furniture',
      priority: 'low',
      status: 'resolved',
      studentIdx: 4,
      roomIdx: 2,
      assignedStaffIdx: 0,
    },
    {
      title: 'WiFi drop on Floor 1 East Wing',
      description: 'High latency and frequent disconnects during evening study hours on 1st floor access point.',
      complaintType: 'maintenance',
      category: 'wifi',
      priority: 'high',
      status: 'in-progress',
      studentIdx: 1,
      roomIdx: 0,
    },
    {
      title: 'Corridor tube light flickering',
      description: 'Tube light near room 104 entrance flickers constantly.',
      complaintType: 'maintenance',
      category: 'electrical',
      priority: 'low',
      status: 'resolved',
      studentIdx: 2,
      roomIdx: 1,
    },
    // General complaints
    {
      title: 'Weekend breakfast timing extension',
      description: 'Request to extend Sunday mess breakfast timing till 10:30 AM instead of 9:30 AM for students preparing for exams.',
      complaintType: 'food',
      category: 'food',
      priority: 'medium',
      status: 'open',
      studentIdx: 5,
      roomIdx: 4,
    },
    {
      title: 'Deep cleaning request for balcony area',
      description: 'Balcony area on floor 2 has gathered dust due to road construction outside.',
      complaintType: 'cleaning',
      category: 'cleaning',
      priority: 'low',
      status: 'resolved',
      studentIdx: 6,
      roomIdx: 4,
      assignedStaffIdx: 2, // cleaner
    },
  ];

  for (const cd of complaintsData) {
    const student = seededStudents[cd.studentIdx];
    const room = seededRooms[cd.roomIdx];
    const staff = cd.assignedStaffIdx !== undefined ? seededStaff[cd.assignedStaffIdx] : null;

    await Complaint.create({
      raisedBy: student._id,
      roomId: room._id,
      hostelId,
      title: cd.title,
      description: cd.description,
      complaintType: cd.complaintType,
      category: cd.category,
      priority: cd.priority,
      status: cd.status,
      assignedTo: staff ? staff._id : undefined,
      assignedStaffName: staff ? staff.name : undefined,
      assignedStaffRole: staff ? (Array.isArray(staff.role) ? staff.role[0] : String(staff.role)) : undefined,
      assignedStaffPhone: staff ? staff.phone : undefined,
      assignedAt: staff ? new Date() : undefined,
    });
  }
  console.log(`Seeded ${complaintsData.length} maintenance and resident complaint tickets.`);

  // 9. Seed Disciplinary Violations
  console.log('Seeding disciplinary violation records...');
  await Violation.deleteMany({ hostelId });

  const violationsData = [
    {
      studentIdx: 4,
      violationType: 'curfew',
      severity: 'high',
      title: 'Late Curfew Breach (45 mins)',
      description: 'Returned to hostel campus at 22:45 without prior late-pass approval. Security logged incident at Main Gate.',
      fineAmount: 500,
      status: 'investigating',
      actionTaken: 'fine',
      actionDetails: 'Parent notified via automated SMS. Curfew counseling scheduled.',
    },
    {
      studentIdx: 7,
      violationType: 'unauthorized-visitor',
      severity: 'medium',
      title: 'Non-Resident in Block After Hours',
      description: 'Brought an unregistered visitor inside room 203 past the 19:00 visitor cutoff window.',
      fineAmount: 200,
      status: 'action_taken',
      actionTaken: 'written_warning',
      actionDetails: 'Formal written warning added to student file.',
    },
    {
      studentIdx: 2,
      violationType: 'noise',
      severity: 'low',
      title: 'Late Night Loud Music Disturbance',
      description: 'Loud music played during silent study hours (23:30). Warden addressed on site.',
      fineAmount: 0,
      status: 'resolved',
      actionTaken: 'verbal_warning',
      actionDetails: 'Verbal warning given; speakers turned off.',
    },
    {
      studentIdx: 1,
      violationType: 'improper-checkout',
      severity: 'low',
      title: 'Missed QR Check-Out Scan',
      description: 'Exited gate during evening market run without scanning biometric/QR kiosk.',
      fineAmount: 100,
      status: 'action_taken',
      actionTaken: 'fine',
      actionDetails: 'Student logged manual exit timestamp with warden.',
    },
  ];

  for (const vd of violationsData) {
    const student = seededStudents[vd.studentIdx];
    await Violation.create({
      hostelId,
      studentId: student._id,
      reportedBy: seededStaff[0]?._id || owner._id,
      violationType: vd.violationType,
      severity: vd.severity,
      title: vd.title,
      description: vd.description,
      fineAmount: vd.fineAmount,
      status: vd.status,
      actionTaken: vd.actionTaken,
      actionDetails: vd.actionDetails,
      incidentDate: new Date(Date.now() - Math.random() * 3 * 86400000),
    });
  }
  console.log(`Seeded ${violationsData.length} disciplinary violations.`);

  // 10. Seed Gate Events (Access Control Logs)
  console.log('Seeding Gate Scan Events...');
  await GateEvent.deleteMany({ hostelId });

  for (let i = 0; i < 10; i++) {
    const student = seededStudents[i % seededStudents.length];
    const isExit = i % 2 === 1;
    const eventTime = new Date(Date.now() - (10 - i) * 7200000); // spread over last ~20 hours

    await GateEvent.create({
      studentId: student._id,
      hostelId,
      type: isExit ? 'out' : 'in',
      time: eventTime,
      location: { latitude: hostelLat, longitude: hostelLng },
      distanceFromHostel: Math.round(15 + Math.random() * 20),
      verificationMethod: 'qr',
      source: 'student',
      serverReceivedAt: eventTime,
    });
  }
  console.log(`Seeded 10 gate scan events.`);

  // 11. Seed Active GeoFence
  console.log('Seeding GeoFence boundaries...');
  await GeoFence.deleteMany({ hostelId });

  // Create active polygon fence around campus
  await GeoFence.create({
    hostelId,
    name: 'Main Campus Perimeter Fence',
    type: 'polygon',
    isActive: true,
    polygon: [
      { latitude: hostelLat + 0.0030, longitude: hostelLng - 0.0030 },
      { latitude: hostelLat + 0.0030, longitude: hostelLng + 0.0030 },
      { latitude: hostelLat - 0.0030, longitude: hostelLng + 0.0030 },
      { latitude: hostelLat - 0.0030, longitude: hostelLng - 0.0030 },
    ],
    radius: 500,
    center: { latitude: hostelLat, longitude: hostelLng },
    description: 'Covers main hostel blocks, garden, mess hall, and entry gates.',
  });
  console.log(`Seeded active GeoFence.`);

  console.log('====================================================');
  console.log('ALL DEMONSTRATION SAMPLE DATA SEEDED SUCCESSFULLY!');
  console.log(`Hostel: "${hostel.name}" (${hostel._id})`);
  console.log(`Rooms: ${seededRooms.length} | Students: ${seededStudents.length} | Staff: ${seededStaff.length}`);
  console.log('====================================================');
  await mongoose.disconnect();
}

seedData().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
