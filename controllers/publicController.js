const Hostel = require('../models/Hostel');
const Enquiry = require('../models/Enquiry');
const CallbackRequest = require('../models/CallbackRequest');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { uploadImageToS3 } = require('../utils/s3Upload');

// Get all public hostels (only active ones)
exports.getPublicHostels = async (req, res) => {
  try {
    const { type, city, minRent, maxRent, search } = req.query;
    
    // Build query
    const query = { status: 'active' };
    
    if (type) {
      query.type = type;
    }
    
    if (city) {
      query['address.city'] = new RegExp(city, 'i');
    }
    
    // Price filtering - find hostels where price range overlaps with filter
    if (minRent || maxRent) {
      const priceFilter = {};
      if (minRent) {
        // Hostel maxRent should be >= minRent, or if no maxRent, minRent should be >= minRent
        priceFilter.$or = [
          { 'pricing.maxRent': { $gte: parseFloat(minRent) } },
          { 'pricing.minRent': { $gte: parseFloat(minRent) } },
        ];
      }
      if (maxRent) {
        // Hostel minRent should be <= maxRent
        if (priceFilter.$or) {
          priceFilter.$and = [
            { $or: priceFilter.$or },
            { 'pricing.minRent': { $lte: parseFloat(maxRent) } },
          ];
          delete priceFilter.$or;
        } else {
          priceFilter['pricing.minRent'] = { $lte: parseFloat(maxRent) };
        }
      }
      
      if (query.$and) {
        query.$and.push(priceFilter);
      } else if (Object.keys(priceFilter).length > 0) {
        query.$and = [priceFilter];
      }
    }
    
    // Search filtering
    if (search) {
      const searchFilter = {
        $or: [
          { name: new RegExp(search, 'i') },
          { 'address.city': new RegExp(search, 'i') },
          { 'address.state': new RegExp(search, 'i') },
          { shortDescription: new RegExp(search, 'i') },
        ],
      };
      
      if (query.$and) {
        query.$and.push(searchFilter);
      } else {
        Object.assign(query, searchFilter);
      }
    }
    
    const hostels = await Hostel.find(query)
      .select('-ownerId -businessInfo -createdAt -updatedAt')
      .sort({ createdAt: -1 });
    
    res.status(200).json({ success: true, count: hostels.length, data: hostels });
  } catch (error) {
    console.error('Error in getPublicHostels:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single public hostel
exports.getPublicHostel = async (req, res) => {
  try {
    const hostel = await Hostel.findOne({
      _id: req.params.id,
      status: 'active',
    })
      .select('-ownerId -businessInfo -createdAt -updatedAt');
    
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }
    
    res.status(200).json({ success: true, data: hostel });
  } catch (error) {
    console.error('Error in getPublicHostel:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create enquiry
exports.createEnquiry = async (req, res) => {
  try {
    const { hostelId, name, email, phone, message } = req.body;
    
    if (!hostelId || !name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Hostel ID, name, email, and phone are required',
      });
    }
    
    // Verify hostel exists
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }
    
    const enquiry = await Enquiry.create({
      hostelId,
      name,
      email,
      phone,
      message: message || '',
      status: 'pending',
    });
    
    res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully',
      data: enquiry,
    });
  } catch (error) {
    console.error('Error in createEnquiry:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create callback request
exports.createCallbackRequest = async (req, res) => {
  try {
    const { hostelId, name, phone, preferredTime } = req.body;
    
    if (!hostelId || !name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Hostel ID, name, and phone are required',
      });
    }
    
    // Verify hostel exists
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }
    
    const callbackRequest = await CallbackRequest.create({
      hostelId,
      name,
      phone,
      preferredTime: preferredTime || 'anytime',
      status: 'pending',
    });
    
    res.status(201).json({
      success: true,
      message: 'Callback request submitted successfully',
      data: callbackRequest,
    });
  } catch (error) {
    console.error('Error in createCallbackRequest:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc   Upload own documents after QR self-registration (student uses their own JWT)
// @route  POST /api/public/self-documents/:studentId
// @access Semi-public (valid student JWT required)
exports.uploadSelfDocuments = async (req, res) => {
  try {
    // Verify the student's own token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // Ensure the token belongs to the same student
    const { studentId } = req.params;
    if (String(decoded.id) !== String(studentId)) {
      return res.status(403).json({ success: false, message: 'Forbidden: token does not match student' });
    }

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No documents provided' });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const uploadedDocuments = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const docType = req.body[`type_${i}`] || 'other';
      const docName = req.body[`name_${i}`] || file.originalname;

      const url = await uploadImageToS3(file, 'students/documents');
      uploadedDocuments.push({
        type: docType,
        name: docName,
        url,
        uploadedAt: new Date(),
      });
    }

    student.documents = [...(student.documents || []), ...uploadedDocuments];
    await student.save();

    res.status(200).json({
      success: true,
      message: 'Documents uploaded successfully',
      data: { documents: student.documents },
    });
  } catch (error) {
    console.error('Self-document upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

