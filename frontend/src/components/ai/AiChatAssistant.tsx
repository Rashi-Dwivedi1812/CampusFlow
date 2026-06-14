import { useState } from "react";
import type { FormEvent } from "react";
import {
  chatWithAi,
  fetchClassroomAssignments,
  getAttendanceHealth,
  getDailySummary,
  getRecommendations,
  summarizeNotifications,
} from "../../services/ai";
import type { ChatMessage } from "../../services/ai";

interface AiChatAssistantProps {
  sessionId: string;
  dashboard: unknown;
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" ? (value as JsonObject) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function buildChatDocuments(dashboard: unknown) {
  const documents: Record<string, unknown>[] = [];
  const dashboardObject = asObject(dashboard);

  if (dashboardObject?.profile) {
    documents.push({
      id: "chat-profile",
      title: "Student profile",
      source: "JPortal",
      text: JSON.stringify(dashboardObject.profile),
    });
  }

  if (dashboardObject?.attendance) {
    documents.push({
      id: "chat-attendance",
      title: "Attendance",
      source: "JPortal",
      text: JSON.stringify(dashboardObject.attendance),
    });
  }

  if (dashboardObject?.subjects) {
    documents.push({
      id: "chat-subjects",
      title: "Subjects and faculty",
      source: "JPortal",
      text: JSON.stringify(dashboardObject.subjects),
    });
  }

  if (dashboardObject?.exams) {
    documents.push({
      id: "chat-exams",
      title: "Exam events",
      source: "JPortal",
      text: JSON.stringify(dashboardObject.exams),
    });
  }

  const assignments = asArray(dashboardObject?.assignments);
  for (const [index, assignment] of assignments.entries()) {
    const assignmentObject = asObject(assignment);
    if (!assignmentObject?.title) continue;
    documents.push({
      id: `chat-assignment-${index}`,
      title: stringValue(assignmentObject.title),
      source: "Google Classroom",
      text: JSON.stringify(assignmentObject),
    });
  }

  const notices = asArray(dashboardObject?.notices);
  for (const [index, notice] of notices.entries()) {
    documents.push({
      id: `chat-notice-${index}`,
      title: "Campus notice",
      source: "CampusFlow",
      text: JSON.stringify(notice),
    });
  }

  return documents;
}

async function fetchAssignmentDocuments(): Promise<Record<string, unknown>[]> {
  try {
    const assignments = await fetchClassroomAssignments();
    return assignments
      .filter((assignment) => asObject(assignment)?.title)
      .map((assignment, index) => ({
        id: `classroom-assignment-${index}`,
        title: stringValue(asObject(assignment)?.title),
        source: "Google Classroom",
        text: JSON.stringify(assignment),
      }));
  } catch (error) {
    console.error("Failed to load Google Classroom assignments", error);
    return [];
  }
}

function buildNotices(dashboard: unknown) {
  const dashboardObject = asObject(dashboard);
  const notices: Record<string, unknown>[] = [];
  const examEvents = asArray(asObject(dashboardObject?.exams)?.examEvents);

  for (const exam of examEvents) {
    const examObject = asObject(exam);
    notices.push({
      title: stringValue(examObject?.exam_event_desc || examObject?.exam_event_code || "Exam update"),
      text: `${stringValue(examObject?.exam_event_code)} ${stringValue(examObject?.event_from)}`.trim(),
      source: "JPortal",
    });
  }

  if (asObject(dashboardObject?.attendance)?.meta) {
    notices.push({
      title: "Attendance data refreshed",
      text: "Latest attendance data is available for review.",
      source: "JPortal",
    });
  }

  return notices;
}

async function fetchRichCampusContextDocuments(
  sessionId: string,
  dashboard: unknown
): Promise<Record<string, unknown>[]> {
  const documents: Record<string, unknown>[] = [];

  const tasks = [
    {
      id: "chat-daily-summary",
      title: "AI daily summary",
      source: "CampusFlow AI",
      promise: getDailySummary(sessionId),
    },
    {
      id: "chat-attendance-health",
      title: "Attendance health",
      source: "CampusFlow AI",
      promise: getAttendanceHealth(sessionId, asObject(dashboard)?.attendance, asObject(dashboard)?.subjects),
    },
    {
      id: "chat-important-updates",
      title: "Important updates",
      source: "CampusFlow AI",
      promise: summarizeNotifications(sessionId, buildNotices(dashboard)),
    },
    {
      id: "chat-recommendations",
      title: "Recommendations",
      source: "CampusFlow AI",
      promise: getRecommendations(sessionId, dashboard),
    },
    {
      id: "chat-classroom-assignments",
      title: "Google Classroom assignments",
      source: "Google Classroom",
      promise: fetchAssignmentDocuments(),
    },
  ];

  const results = await Promise.allSettled(tasks.map((task) => task.promise));

  results.forEach((result, index) => {
    if (result.status !== "fulfilled") {
      console.warn(`Context load failed: ${tasks[index].id}`, result.reason);
      return;
    }

    const task = tasks[index];
    if (task.id === "chat-classroom-assignments") {
      documents.push(...(Array.isArray(result.value) ? result.value : []));
      return;
    }

    documents.push({
      id: task.id,
      title: task.title,
      source: task.source,
      text: JSON.stringify(result.value),
    });
  });

  return documents;
}

export default function AiChatAssistant({ sessionId, dashboard }: AiChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi! I'm your CampusFlow assistant. I can summarize your day, track assignments, explain attendance risk, plan study time, and answer campus questions.",
    },
  ]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const contextDocuments = await fetchRichCampusContextDocuments(sessionId, dashboard);
      const response = await chatWithAi(
        sessionId,
        dashboard,
        trimmed,
        buildChatDocuments(dashboard).concat(contextDocuments)
      );
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: response.answer || "Verified information not found.",
        },
      ]);
    } catch (error) {
      console.error(error);
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "I could not reach the AI service right now. Please check that the Python AI service is running, then try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-indigo-600 px-5 py-4 font-semibold text-white shadow-xl transition hover:bg-indigo-500"
      >
        AI Assistant
      </button>

      {open ? (
        <div className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[min(92vw,420px)] flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="border-b border-slate-800 p-4">
            <h3 className="font-bold">CampusFlow AI</h3>
            <p className="text-xs text-slate-400">Unified campus assistant · verified context aware</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  message.role === "user"
                    ? "ml-auto bg-indigo-600 text-white"
                    : "mr-auto border border-slate-700 bg-slate-800 text-slate-200"
                }`}
              >
                {message.content}
              </div>
            ))}
            {loading ? (
              <div className="mr-auto max-w-[85%] rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-400">
                Thinking...
              </div>
            ) : null}
          </div>

          <form onSubmit={sendMessage} className="border-t border-slate-800 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about your day, assignments, attendance, exams, or campus life..."
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                disabled={loading || !input.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
