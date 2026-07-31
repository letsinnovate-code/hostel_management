const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function createSecurityUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hostel_management');
    console.log('Connected to MongoDB');

    // Check if security user already exists
    const existingUser = await User.findOne({ email: 'security@test.com' });
    if (existingUser) {
      console.log('Security user already exists:');
      console.log('Email:', existingUser.email);
      console.log('Name:', existingUser.name);
      console.log('Roles:', existingUser.role);
      console.log('Current Role:', existingUser.currentRole);
      
      // Update password to Test@123
      existingUser.password = 'Test@123';
      await existingUser.save();
      console.log('\nPassword updated to: Test@123');
      console.log('You can now login with:');
      console.log('Email: security@test.com');
      console.log('Password: Test@123');
    } else {
      // Create new security user
      const securityUser = await User.create({
        name: 'Security Guard',
        email: 'security@test.com',
        password: 'Test@123',
        role: ['security'],
        currentRole: 'security',
        phone: '+919999999999',
        status: 'active',
      });

      console.log('Security user created successfully:');
      console.log('Email:', securityUser.email);
      console.log('Password: Test@123');
      console.log('Role:', securityUser.role);
    }

    // List all security users
    console.log('\n--- All Security Users ---');
    const allSecurityUsers = await User.find({ role: { $in: ['security'] } });
    allSecurityUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - Roles: ${Array.isArray(user.role) ? user.role.join(', ') : user.role}`);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createSecurityUser();
