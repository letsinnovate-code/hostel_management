# API Usage Examples

## Authentication

### Register a User
```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "student",
  "phone": "1234567890",
  "hostelId": "hostel_id_here",
  "studentId": "STU001"
}
```

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "data": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "student",
    "token": "jwt_token_here"
  }
}
```

## Admin Endpoints

### Create Hostel
```bash
POST /api/owner/hostels
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Boys Hostel A",
  "address": {
    "street": "123 Main St",
    "city": "City",
    "state": "State",
    "pincode": "123456"
  },
  "contact": {
    "phone": "1234567890",
    "email": "hostel@example.com"
  },
  "capacity": 500,
  "rules": {
    "curfewTime": "22:00",
    "lateEntryAllowed": true,
    "visitorPolicy": "Approved visitors only"
  }
}
```

### Create Block
```bash
POST /api/owner/blocks
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Block A",
  "hostelId": "hostel_id_here",
  "floors": [
    {
      "floorNumber": 1,
      "rooms": []
    }
  ]
}
```

### Create Room
```bash
POST /api/owner/rooms
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "roomNumber": "A101",
  "blockId": "block_id_here",
  "floorNumber": 1,
  "capacity": 2
}
```

### Create Rule
```bash
POST /api/owner/rules
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "hostelId": "hostel_id_here",
  "ruleType": "curfew",
  "title": "Curfew Time",
  "description": "Students must be inside by 10 PM",
  "curfewTime": "22:00",
  "fineAmount": 100,
  "escalationLevel": "warden"
}
```

### Get Analytics
```bash
GET /api/owner/analytics/attendance?hostelId=hostel_id&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <admin_token>
```

## Warden Endpoints

### Get Dashboard
```bash
GET /api/warden/dashboard?hostelId=hostel_id
Authorization: Bearer <warden_token>
```

### Approve Permission
```bash
POST /api/warden/permissions/:permissionId/approve
Authorization: Bearer <warden_token>
```

### Create Violation
```bash
POST /api/warden/violations
Authorization: Bearer <warden_token>
Content-Type: application/json

{
  "studentId": "student_id",
  "violationType": "curfew",
  "description": "Returned after curfew time",
  "fineAmount": 100,
  "warningLevel": "first"
}
```

### Approve Visitor
```bash
POST /api/warden/visitors/:visitorId/approve
Authorization: Bearer <warden_token>
```

## Student Endpoints

### Check In
```bash
POST /api/student/check-in
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946
  }
}
```

### Request Permission (Late Entry)
```bash
POST /api/student/permissions
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "permissionType": "late-entry",
  "reason": "College event",
  "requestedDate": "2024-01-15T20:00:00Z"
}
```

### Request Leave
```bash
POST /api/student/permissions
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "permissionType": "multi-day",
  "reason": "Family emergency",
  "requestedDate": "2024-01-15T00:00:00Z",
  "returnDate": "2024-01-20T00:00:00Z"
}
```

### Create Complaint
```bash
POST /api/student/complaints
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "complaintType": "cleaning",
  "title": "Room not cleaned",
  "description": "Room was not cleaned today",
  "priority": "medium"
}
```

### Emergency SOS
```bash
POST /api/student/emergency
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "emergencyType": "sos",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "address": "Room A101"
  },
  "description": "Medical emergency"
}
```

### Request Visitor
```bash
POST /api/student/visitors
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "visitorName": "John Parent",
  "visitorPhone": "9876543210",
  "visitorIdProof": "Aadhar: 1234 5678 9012",
  "purpose": "Meeting"
}
```

## Cleaner Endpoints

### Get Tasks
```bash
GET /api/cleaner/tasks?status=pending&date=2024-01-15
Authorization: Bearer <cleaner_token>
```

### Complete Task
```bash
POST /api/cleaner/tasks/:taskId/complete
Authorization: Bearer <cleaner_token>
Content-Type: application/json

{
  "notes": "Cleaned thoroughly",
  "afterImages": ["https://example.com/image1.jpg"]
}
```

### Clock In
```bash
POST /api/cleaner/attendance/clock-in
Authorization: Bearer <cleaner_token>
```

## Error Responses

All endpoints return errors in the following format:
```json
{
  "success": false,
  "message": "Error message here"
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

