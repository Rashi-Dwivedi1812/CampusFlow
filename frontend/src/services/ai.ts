import axios from "axios";

const API = "http://localhost:5001/api/ai";
const REQUEST_TIMEOUT_MS = 20000;

export interface DailySummary {
  greeting: string;
  class_count: number;
  todays_classes: Array<{ subject: string; time: string; location: string }>;
  attendance_alerts: Array<{ subject: string; attendance: number; risk: string; recommendation: string }>;
  pending_assignments: Array<{ title: string; course: string; due_date: string | null; days_left: number | null }>;
  important_notices: Array<{ title: string; text: string; source: string }>;
  placement_reminders: string[];
  recommended_actions: string[];
}

export interface AttendanceHealthItem {
  subject: string;
  attendance: number;
  risk: string;
  safe_skips: number;
  required_classes: number;
  recommendation: string;
}

export interface NotificationUpdate {
  title: string;
  summary: string;
  urgency: "HIGH" | "MEDIUM" | "LOW";
  importance: number;
  category: string;
  source: string;
}

export interface Recommendation {
  score: number;
  text: string;
  category: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const getDailySummary = async (sessionId: string) => {
  const response = await axios.get(`${API}/daily-summary`, {
    params: { sessionId },
    withCredentials: true,
    timeout: REQUEST_TIMEOUT_MS,
  });
  return response.data;
};

export const getAttendanceHealth = async (
  sessionId: string,
  attendance: unknown,
  subjects: unknown
) => {
  const response = await axios.post(
    `${API}/attendance-health`,
    { sessionId, attendance, subjects },
    { withCredentials: true, timeout: REQUEST_TIMEOUT_MS }
  );
  return response.data;
};

export const summarizeNotifications = async (
  sessionId: string,
  notifications: unknown[]
) => {
  const response = await axios.post(
    `${API}/notifications/summarize`,
    { sessionId, notifications },
    { withCredentials: true, timeout: REQUEST_TIMEOUT_MS }
  );
  return response.data;
};

export const getRecommendations = async (
  sessionId: string,
  dashboard: unknown
) => {
  const response = await axios.post(
    `${API}/recommendations`,
    { sessionId, dashboard },
    { withCredentials: true, timeout: REQUEST_TIMEOUT_MS }
  );
  return response.data;
};

export const chatWithAi = async (
  sessionId: string,
  dashboard: unknown,
  message: string,
  documents?: Record<string, unknown>[]
) => {
  const response = await axios.post(
    `${API}/chat`,
    { sessionId, message, dashboard, documents },
    { withCredentials: true, timeout: REQUEST_TIMEOUT_MS }
  );
  return response.data;
};

export const fetchClassroomAssignments = async () => {
  const response = await axios.get(
    "http://localhost:5001/api/classroom/all-assignments",
    { withCredentials: true, timeout: REQUEST_TIMEOUT_MS }
  );
  return Array.isArray(response.data) ? response.data : [];
};
