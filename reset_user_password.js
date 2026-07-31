const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function resetUserPassword() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hostel_management');
    console.log('Connected to MongoDB');

    const email = 'pranjal@zifypay.com';
    const newPassword = 'Test@123'; // Set a known password

    // Find the user
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`User with email ${email} not found`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('Found user:');
    console.log('Name:', user.name);
    console.log('Email:', user.email);
    console.log('Roles:', Array.isArray(user.role) ? user.role.join(', ') : user.role);
    console.log('Current Role:', user.currentRole);

    // Update password
    user.password = newPassword;
    await user.save();

    console.log('\n✅ Password reset successfully!');
    console.log('New password:', newPassword);
    console.log('\nYou can now login with:');
    console.log('Email:', email);
    console.log('Password:', newPassword);

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetUserPassword();
