import { useEffect, useState } from "react";
import axios from "axios";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export default function UpcomingAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const { data } = await axios.get(
        "http://localhost:5001/api/classroom/all-assignments",
        {
          withCredentials: true,
        }
      );

      setAssignments(data);
      setError("");
    } catch (error) {
      console.error(error);
      setError(
        axios.isAxiosError(error) && error.response?.status === 401
          ? "Connect Google Classroom to view upcoming assignments."
          : "Failed to load assignments."
      );
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const getDueDate = (dueDate) => {
    if (!dueDate?.year || !dueDate.month || !dueDate.day) return null;

    return new Date(dueDate.year, dueDate.month - 1, dueDate.day);
  };

  const getUrgencyBadge = (dueDate) => {
  const parsedDueDate = getDueDate(dueDate);

  if (!parsedDueDate) {
    return {
      label: "No Due Date",
      className:
        "bg-slate-100 text-slate-700",
    };
  }

  const daysLeft = Math.ceil(
    (parsedDueDate - new Date()) / MS_PER_DAY
  );

  if (daysLeft === 0) {
    return {
      label: "Due Today",
      className:
        "bg-red-100 text-red-700",
    };
  }

  if (daysLeft === 1) {
    return {
      label: "Tomorrow",
      className:
        "bg-orange-100 text-orange-700",
    };
  }

  if (daysLeft <= 7) {
    return {
      label: "This Week",
      className:
        "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "Upcoming",
    className:
      "bg-emerald-100 text-emerald-700",
  };
};

  const getUpcomingAssignments = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return assignments
      .map((assignment) => ({
        ...assignment,
        parsedDueDate: getDueDate(assignment.dueDate),
      }))
      .filter((assignment) => assignment.parsedDueDate >= today)
      .sort((a, b) => a.parsedDueDate - b.parsedDueDate)
      .slice(0, 5);
  };

  const upcomingAssignments = getUpcomingAssignments();

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow p-5">
        Loading assignments...
      </div>
    );
  }

  return (
  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
    {/* Header */}
    <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            Upcoming Assignments
          </h2>
          <p className="mt-1 text-sm text-indigo-100">
            Track your next deadlines
          </p>
        </div>

        <div className="rounded-2xl bg-white/20 px-4 py-2 backdrop-blur-md">
          <span className="text-lg font-bold">
            {upcomingAssignments.length}
          </span>
          <p className="text-xs text-indigo-100">
            Pending
          </p>
        </div>
      </div>
    </div>

    {/* Loading */}
    {loading ? (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-20 rounded-2xl bg-slate-200"></div>
          <div className="h-20 rounded-2xl bg-slate-200"></div>
          <div className="h-20 rounded-2xl bg-slate-200"></div>
        </div>
      </div>
    ) : error ? (
      /* Error State */
      <div className="p-6">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>

            <div className="flex-1">
              <h3 className="font-semibold text-orange-900">
                Google Classroom Not Connected
              </h3>

              <p className="mt-1 text-sm text-orange-700">
                {error}
              </p>

              <a
                href="http://localhost:5001/api/classroom/login"
                className="mt-4 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                Connect Classroom →
              </a>
            </div>
          </div>
        </div>
      </div>
    ) : upcomingAssignments.length === 0 ? (
      /* Empty State */
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <div className="mb-4 text-6xl">🎉</div>

        <h3 className="text-lg font-semibold text-slate-800">
          No Upcoming Assignments
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          You're all caught up for now.
        </p>
      </div>
    ) : (
      /* Assignment List */
      <div className="space-y-4 p-6">
        {upcomingAssignments.map((assignment) => {
          const badge = getUrgencyBadge(
            assignment.dueDate
          );

          return (
            <div
              key={
                assignment.courseId +
                assignment.title +
                assignment.dueDate?.year
              }
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:bg-white hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-semibold text-slate-900">
                    {assignment.title}
                  </h3>

                  <p className="mt-1 text-sm font-medium text-indigo-600">
                    {assignment.courseName}
                  </p>

                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                    <span>📅</span>

                    <span>
                      {getDueDate(
                        assignment.dueDate
                      )?.toLocaleDateString() ||
                        "No Due Date"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>

                  <a
                    href={assignment.link}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-600"
                  >
                    Open
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
}
