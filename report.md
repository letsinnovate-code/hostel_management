# Hostel Management System - Architecture & Technical Report

## 1. Project Overview
The Hostel Management System is a comprehensive platform designed for streamlining all hostel operations. It provides dedicated, role-based interfaces for Owners, Wardens, Security Personnel, Cleaners, and Students. The project employs a modern tech stack to ensure high performance, type safety, and real-time capabilities.

## 2. High-Level Architecture & Data Flow

The system is structured as a full-stack Javascript/TypeScript monorepo environment containing the following core layers:

1. **Frontend Web App (`hostelzify/`)**
   - Built on **Next.js 14+** utilizing the App Router.
   - **Role-based routing architecture**: Dedicated portal directories (`/owner`, `/warden`, `/student`, `/security`, `/cleaner`, `/superadmin`).
   - Uses **React Query** (`@tanstack/react-query`) for robust server state management, caching, and background data synchronization.
   
2. **Mobile Application (`mobile-app/`)**
   - Built using **React Native (Expo)** to provide an on-the-go experience for Students and Wardens (e.g., SOS features, quick leave requests).
   
3. **Shared API Client (`packages/api-client/`)**
   - The critical connective tissue of the data flow.
   - Houses strongly-typed Axios configurations and request wrappers.
   - Ensures the Next.js app and Mobile app consume APIs with a single source of truth, reducing drift between backend responses and frontend types.

4. **Backend API (`src/`)**
   - **Node.js & Express.js** RESTful server.
   - Connects to a **MongoDB** database via **Mongoose** ORM.
   - Employs modular domains: Controllers handle business logic, Services handle background automations, and Routes expose the API.

5. **Real-time & Background Processing**
   - **Socket.io** (`socketManager.js`) broadcasts live events (e.g., a student scanning out at the gate instantly updates the Warden's dashboard).
   - **Push Notifications** (`notificationService.js`) integrates Firebase Cloud Messaging (FCM) and Expo Push APIs.
   - **Cron Automations**: Background services automatically flag curfew breaches, calculate late fees, and auto-checkout missing students.

---

## 3. Database Schema & Domain Models (MongoDB)

The data layer is highly relational (via ObjectIds) despite being NoSQL.

- **Infrastructure**: 
  - `Hostel.js`, `Block.js`, `Room.js`: Defines the physical hierarchy.
  - `RoomAllocationHistory.js`: Audit trail of which student stayed in which room and when.
  - `GeoFence.js`: Defines GPS boundaries for automated attendance and alerts.
- **Users & Onboarding**:
  - `User.js`: Base identity schema supporting roles (`STUDENT`, `WARDEN`, `OWNER`, etc.).
  - `StudentOnboarding.js`: Handles the KYC, document upload, and approval pipeline for incoming tenants.
- **Operations & Security**:
  - `Attendance.js`, `GateEvent.js`, `StudentLocation.js`: Tracks physical presence.
  - `Visitor.js`: Logs external guests mapped to specific students.
- **Rules & Enforcement**:
  - `Permission.js`: Tracks leave/outpass requests.
  - `Rule.js`, `Violation.js`: Stores hostel regulations and logs infractions (e.g., "Late Entry", "Property Damage").
- **Services & Support**:
  - `Complaint.js`: Maintenance and facility tickets.
  - `MessSchedule.js`: Meal timetables and dietary tracking.
  - `FeeStructure.js`, `Payment.js`: Billing, invoicing, and Razorpay integration.
- **System**:
  - `AuditLog.js`, `Emergency.js`, `Notification.js`.

---

## 4. API Routing & Workflow

The backend routes (`src/routes/`) act as the entry points for the various workflows:

### Authentication (`authRoutes.js`)
- Handles JWT generation, login, password resets, and session validation.

### Operations & Staff
- **`ownerRoutes.js`**: Administrative endpoints for managing staff, updating infrastructure (rooms, hostels), setting fee structures, and reviewing high-level analytics.
- **`wardenRoutes.js`**: Tactical endpoints for day-to-day operations. Wardens fetch pending leave requests (`Permission`), approve/reject them, review daily `GateEvent` logs, and manage `Complaint` escalations.
- **`securityRoutes.js`**: Highly restricted endpoints used at the physical gates to log entry/exit (creating `GateEvent` records) and register `Visitor` access.
- **`cleanerRoutes.js`**: Endpoints to fetch assigned housekeeping tasks and mark `Complaint` tickets as resolved.

### Student Self-Service (`studentRoutes.js`)
- Allows authenticated students to fetch their dues (`Payment`), raise `Complaint` tickets, apply for outpasses (`Permission`), and view the `MessSchedule`.

### System & Admin
- **`superadminRoutes.js`**: For the SaaS platform operators to onboard new Owners and manage global metrics.
- **`onboardingRoutes.js`**: Dedicated pipeline for handling multipart form data (documents, photos) during tenant registration.

---

## 5. Key Features & Data Sync Mechanisms

1. **Automated Attendance & Curfew (Data Flow)**
   - **Flow**: Security logs an exit via `securityRoutes`. A `GateEvent` is created.
   - **Sync**: The `CurfewAutomationService` periodically polls `StudentLocation` and `GateEvent`. If a student is out past curfew and has no approved `Permission`, a `Violation` is created.
   - **Alert**: A Socket event pushes the violation to the Warden's dashboard, and `NotificationService` pushes a Firebase alert to the Student's phone.

2. **Complaints Management (Data Flow)**
   - **Flow**: Student submits form -> `studentRoutes` -> Creates `Complaint` -> Client cache invalidated -> Cleaner queries `cleanerRoutes` -> Dashboard auto-refreshes via React Query.

3. **Client-Server Synchronization**
   - The frontend heavily utilizes React Query's `stale-while-revalidate` pattern.
   - Instead of manually refreshing pages, mutations (like approving a leave request) trigger a query invalidation, causing the UI to seamlessly refetch the exact slice of updated data.

## 6. Summary
The architecture is designed to be highly decoupled yet strictly typed. By isolating the API interactions into `packages/api-client`, the Next.js web application and the Expo mobile application can iterate rapidly without breaking API contracts, while the Express backend relies heavily on automated background jobs and socket events to reduce manual warden workloads.
