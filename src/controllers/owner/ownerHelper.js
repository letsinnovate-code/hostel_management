/**
 * @file controllers/owner/ownerHelper.js
 * @description Shared helper utilities, payload sanitizers, and scoping functions for owner controllers.
 */

'use strict';

const {
  getOwnerHostelIds,
  assertOwnsHostel,
  assertHostelIdBelongsToOwner,
  getScopedHostelIds,
} = require('../../middleware/ownerSecurity');
const { isSuperadmin: checkSuperadmin, isOwner: checkOwner } = require('../../utils/roleHelper');

// Helper function to sanitize hostel payload to avoid Mongoose validation errors
function sanitizeHostelPayload(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const data = { ...raw };

  // Valid enums
  const validTypes = ['boys', 'girls', 'co-ed'];
  if (data.type !== undefined) {
    if (!validTypes.includes(data.type)) {
      data.type = 'boys';
    }
  }

  const validStatus = ['active', 'inactive', 'pending', 'suspended'];
  if (data.status !== undefined) {
    if (!validStatus.includes(data.status)) {
      data.status = 'active';
    }
  }

  // Numbers at top level
  if (data.capacity !== undefined) data.capacity = Number(data.capacity) || 0;
  if (data.totalRooms !== undefined) data.totalRooms = Number(data.totalRooms) || 0;
  if (data.totalBlocks !== undefined) data.totalBlocks = Number(data.totalBlocks) || 0;
  if (data.totalFloors !== undefined) data.totalFloors = Number(data.totalFloors) || 0;

  // Images
  if (data.images != null) {
    const rawImgs = data.images;
    data.images = Array.isArray(rawImgs)
      ? rawImgs.map((u) => (typeof u === 'string' ? u : String(u))).filter(Boolean)
      : typeof rawImgs === 'string' && rawImgs.trim()
      ? [rawImgs.trim()]
      : [];
  }

  // Address
  if (data.address && typeof data.address === 'object') {
    const addr = { ...data.address };
    const coords = addr.coordinates;
    if (
      !coords ||
      typeof coords.latitude !== 'number' ||
      typeof coords.longitude !== 'number' ||
      isNaN(coords.latitude) ||
      isNaN(coords.longitude)
    ) {
      delete addr.coordinates;
    }
    data.address = addr;
  }

  // Amenities
  if (data.amenities && typeof data.amenities === 'object') {
    const a = { ...data.amenities };
    const validLaundry = ['self-service', 'service', 'both'];
    if (!validLaundry.includes(a.laundryType)) a.laundryType = 'self-service';

    const validMess = ['vegetarian', 'non-vegetarian', 'both'];
    if (!validMess.includes(a.messType)) a.messType = 'both';

    const validParking = ['two-wheeler', 'four-wheeler', 'both'];
    if (!validParking.includes(a.parkingType)) a.parkingType = 'two-wheeler';

    if (a.wifiCost !== undefined) a.wifiCost = Number(a.wifiCost) || 0;
    if (a.laundryCost !== undefined) a.laundryCost = Number(a.laundryCost) || 0;
    if (a.messCost !== undefined) a.messCost = Number(a.messCost) || 0;
    if (a.parkingCost !== undefined) a.parkingCost = Number(a.parkingCost) || 0;
    data.amenities = a;
  }

  // Facilities
  if (data.facilities && typeof data.facilities === 'object') {
    const f = { ...data.facilities };
    const validWater = ['24x7', 'scheduled', 'limited'];
    if (!validWater.includes(f.waterSupplyType)) f.waterSupplyType = '24x7';

    if (f.securityGuards !== undefined) f.securityGuards = Number(f.securityGuards) || 0;
    if (f.cctvCount !== undefined) f.cctvCount = Number(f.cctvCount) || 0;
    if (f.powerBackupHours !== undefined) f.powerBackupHours = Number(f.powerBackupHours) || 0;
    data.facilities = f;
  }

  // Pricing
  if (data.pricing && typeof data.pricing === 'object') {
    const p = { ...data.pricing };
    const validElec = ['included', 'separate', 'metered'];
    if (!validElec.includes(p.electricityCharges)) p.electricityCharges = 'separate';

    const validWater = ['included', 'separate'];
    if (!validWater.includes(p.waterCharges)) p.waterCharges = 'included';

    if (p.minRent !== undefined) p.minRent = Number(p.minRent) || 0;
    if (p.maxRent !== undefined) p.maxRent = Number(p.maxRent) || 0;
    if (p.securityDeposit !== undefined) p.securityDeposit = Number(p.securityDeposit) || 0;
    if (p.maintenanceCharges !== undefined) p.maintenanceCharges = Number(p.maintenanceCharges) || 0;
    data.pricing = p;
  }

  // Rules
  if (data.rules && typeof data.rules === 'object') {
    const r = { ...data.rules };
    if (r.lateEntryFine !== undefined) r.lateEntryFine = Number(r.lateEntryFine) || 0;
    if (r.messTimings && typeof r.messTimings === 'object') {
      r.messTimings = {
        breakfast: r.messTimings.breakfast || '',
        lunch: r.messTimings.lunch || '',
        dinner: r.messTimings.dinner || '',
      };
    }
    data.rules = r;
  }

  return data;
}

module.exports = {
  sanitizeHostelPayload,
  getOwnerHostelIds,
  assertOwnsHostel,
  assertHostelIdBelongsToOwner,
  getScopedHostelIds,
  checkSuperadmin,
  checkOwner,
};
