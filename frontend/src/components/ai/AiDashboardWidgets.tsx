import { useEffect, useState } from "react";
import {
  getAttendanceHealth,
  getDailySummary,
  getRecommendations,
  summarizeNotifications,
} from "../../services/ai";
import type {
  DailySummary,
  NotificationUpdate,
  Recommendation,
} from "../../services/ai";

import type { AttendanceHealthItem } from "../../services/ai";

type JsonObject = Record<string, unknown>;
type NoticePayload = {
  title: string;
  text: string;
  source: string;
};

interface AiDashboardWidgetsProps {
  sessionId: string;
  dashboard: unknown;
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" ? (value as JsonObject) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function buildNotices(dashboard: unknown) {
  const notices: NoticePayload[] = [];
  const dashboardObject = asObject(dashboard);
  const exams = asObject(dashboardObject?.exams);
  const examEvents = asArray(exams?.examEvents);

  for (const exam of examEvents) {
    const examObject = asObject(exam);
    notices.push({
      title: stringValue(examObject?.exam_event_desc || examObject?.exam_event_code || "Exam update"),
      text: `${stringValue(examObject?.exam_event_code)} ${stringValue(examObject?.event_from)}`.trim(),
      source: "JPortal",
    });
  }

  const attendance = asObject(dashboardObject?.attendance);
  if (attendance?.meta) {
    notices.push({
      title: "Attendance data refreshed",
      text: "Latest attendance data is available for review.",
      source: "JPortal",
    });
  }

  return notices;
}

function riskClass(risk: string) {
  if (risk === "critical") return "bg-red-500/15 text-red-300 border-red-500/40";
  if (risk === "high") return "bg-orange-500/15 text-orange-300 border-orange-500/40";
  if (risk === "medium") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
}

function urgencyClass(urgency: string) {
  if (urgency === "HIGH") return "bg-red-500/15 text-red-300 border-red-500/40";
  if (urgency === "MEDIUM") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-slate-700 text-slate-300 border-slate-600";
}

export default function AiDashboardWidgets({ sessionId, dashboard }: AiDashboardWidgetsProps) {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [attendanceHealth, setAttendanceHealth] = useState<AttendanceHealthItem[]>([]);
  const [updates, setUpdates] = useState<NotificationUpdate[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAiData() {
      setLoading(true);
      setError("");

      try {
        const dashboardObject = asObject(dashboard) || {};
        const [summaryData, attendanceData, updatesData, recommendationData] = await Promise.all([
          getDailySummary(sessionId),
          getAttendanceHealth(sessionId, dashboardObject.attendance, dashboardObject.subjects),
          summarizeNotifications(sessionId, buildNotices(dashboardObject)),
          getRecommendations(sessionId, dashboardObject),
        ]);

        if (!cancelled) {
          setSummary(summaryData);
          setAttendanceHealth(attendanceData?.items || []);
          setUpdates(updatesData?.items || []);
          setRecommendations(recommendationData?.recommendations || []);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("AI assistant is unavailable. Existing CampusFlow features remain available.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAiData();

    return () => {
      cancelled = true;
    };
  }, [sessionId, dashboard]);

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-40 rounded bg-slate-700"></div>
          <div className="h-20 rounded-xl bg-slate-800"></div>
          <div className="h-20 rounded-xl bg-slate-800"></div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-orange-500/30 bg-orange-500/10 p-6">
        <h3 className="font-semibold text-orange-200">AI unavailable</h3>
        <p className="mt-2 text-sm text-orange-200/80">{error}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">AI Smart Summary</h3>
              <p className="text-sm text-slate-400">Generated by the Python AI service</p>
            </div>
            <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300">
              {summary?.class_count || 0} classes
            </span>
          </div>

          <p className="text-lg font-semibold text-white">{summary?.greeting}</p>

          <div className="mt-5 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-300">Today's classes</h4>
              <ul className="mt-2 space-y-2 text-sm text-slate-300">
                {(summary?.todays_classes || []).map((item, index) => (
                  <li key={index} className="rounded-xl bg-slate-800 px-3 py-2">
                    <span className="font-medium text-white">{item.subject}</span>
                    <span className="ml-2 text-slate-400">{item.time || "Time not listed"}</span>
                    {item.location ? <span className="ml-2 text-slate-400">{item.location}</span> : null}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-300">Important</h4>
              <ul className="mt-2 space-y-2 text-sm text-slate-300">
                {(summary?.pending_assignments || []).map((assignment, index) => (
                  <li key={index} className="rounded-xl bg-slate-800 px-3 py-2">
                    {assignment.title}
                    {assignment.due_date ? <span className="text-slate-400"> due {assignment.due_date}</span> : null}
                  </li>
                ))}
                {(summary?.attendance_alerts || []).map((alert, index) => (
                  <li key={index} className="rounded-xl bg-slate-800 px-3 py-2">
                    {alert.subject} attendance is {alert.attendance}%
                  </li>
                ))}
                {(summary?.placement_reminders || []).map((reminder, index) => (
                  <li key={index} className="rounded-xl bg-slate-800 px-3 py-2">
                    {reminder}
                  </li>
                ))}
                {(summary?.important_notices || []).map((notice, index) => (
                  <li key={index} className="rounded-xl bg-slate-800 px-3 py-2">
                    {notice.title}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-300">Recommended</h4>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
                {(summary?.recommended_actions || []).map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Attendance Health</h3>
              <p className="text-sm text-slate-400">Risk, safe skips, and required classes</p>
            </div>
          </div>

          {attendanceHealth.length === 0 ? (
            <p className="text-sm text-slate-400">Attendance data is not available yet.</p>
          ) : (
            <div className="space-y-3">
              {attendanceHealth.slice(0, 5).map((item, index) => (
                <div key={index} className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">{item.subject}</h4>
                      <p className="text-sm text-slate-400">{item.recommendation}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskClass(item.risk)}`}>
                      {item.attendance}% {item.risk}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300">
                    <div className="rounded-xl bg-slate-900 px-3 py-2">
                      Safe skips
                      <div className="font-semibold text-white">{item.safe_skips}</div>
                    </div>
                    <div className="rounded-xl bg-slate-900 px-3 py-2">
                      Required
                      <div className="font-semibold text-white">{item.required_classes}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Important Updates</h3>
              <p className="text-sm text-slate-400">Classroom, portal, and campus notices</p>
            </div>
          </div>

          {updates.length === 0 ? (
            <p className="text-sm text-slate-400">No high-signal updates found.</p>
          ) : (
            <div className="space-y-3">
              {updates.slice(0, 5).map((update, index) => (
                <div key={index} className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate font-semibold">{update.title}</h4>
                      <p className="mt-1 text-sm text-slate-400">{update.summary}</p>
                      <p className="mt-2 text-xs text-slate-500">{update.source} · {update.category}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${urgencyClass(update.urgency)}`}>
                      {update.urgency}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4">
            <h3 className="text-xl font-bold">Recommendation Cards</h3>
            <p className="text-sm text-slate-400">Maximum three proactive actions</p>
          </div>

          {recommendations.length === 0 ? (
            <p className="text-sm text-slate-400">No urgent recommendations right now.</p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((item, index) => (
                <div key={index} className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-indigo-100">{item.text}</p>
                    <span className="rounded-full bg-indigo-500 px-2 py-1 text-xs font-semibold text-white">
                      {item.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
