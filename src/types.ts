/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'student' | 'admin';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  usn?: string;           // Optional for admins
  adminId?: string;       // Optional for students
  department?: string;    // Optional for admins
  accountStatus?: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
}

export interface UserRoleRecord {
  id: string;
  userId: string;
  role: UserRole;
}

export interface Session {
  id: string;
  name: string;
  description: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM:SS or HH:MM
  endTime: string;       // HH:MM:SS or HH:MM
  venue: string;
  hostedBy: string;
  resourcePerson: string;
  numberOfVolunteers: number;
  volunteers?: string[];
  status: 'inactive' | 'live' | 'expired';
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  studentUsn: string;
  studentDept: string;
  checkInTime: string;
  method: 'qr' | 'manual';
}

export interface Assignment {
  id: string;
  sessionId?: string;
  title: string;
  description: string;
  resources?: string;
  attachedFiles: Array<{ name: string; url: string; size?: string }>;
  attachedLinks: string[];
  deadline: string;      // ISO dynamic deadline string
  createdAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentUsn: string;
  submittedAt: string;
  attachedFiles: Array<{ name: string; url: string; size?: string }>;
  attachedLinks: string[];
}

export interface SessionSummary {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  studentUsn: string;
  summary: string;
  learnings: string;
  reflections: string;
  suggestions: string;
  feedback: string;
  submittedAt: string;
  rating?: number;
  contentQualityRating?: number;
  instructorRating?: number;
  relevanceRating?: number;
  engagementRating?: number;
  learningImpact?: string;
  confidenceLevel?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  roleTarget: 'all' | 'student' | 'admin';
  readBy: string[]; // List of user IDs who read it
}

export interface AttendanceToken {
  id: string;
  sessionId: string;
  studentId: string;
  attendanceToken: string;
  generatedAt: string;
  expiresAt: string;
  usedAt?: string;
  isVerified: boolean;
}
