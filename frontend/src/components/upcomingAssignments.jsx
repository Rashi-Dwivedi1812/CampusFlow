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
        className: "bg-gray-100 text-gray-700",
      };
    }

    const daysLeft = Math.ceil(
      (new Date(
        dueDate.year,
        dueDate.month - 1,
        dueDate.day
      ) - new Date()) /
        MS_PER_DAY
    );

    if (daysLeft === 0) {
      return {
        label: "🔴 Due Today",
        className: "bg-red-100 text-red-700",
      };
    }

    if (daysLeft === 1) {
      return {
        label: "🟠 Due Tomorrow",
        className: "bg-orange-100 text-orange-700",
      };
    }

    if (daysLeft <= 7) {
      return {
        label: "🟡 Due This Week",
        className: "bg-yellow-100 text-yellow-700",
      };
    }

    return {
      label: "🟢 Upcoming",
      className: "bg-green-100 text-green-700",
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
    <div className="bg-white rounded-2xl shadow-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-xl">
          📚 Upcoming Assignments
        </h2>

        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
          {upcomingAssignments.length} Next
        </span>
      </div>

      {error ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-800">
          <p className="mb-3 text-sm">{error}</p>
          <a
            href="http://localhost:5001/api/classroom/login"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Connect Google Classroom
          </a>
        </div>
      ) : upcomingAssignments.length === 0 ? (
        <p className="text-gray-500">
          No upcoming assignments.
        </p>
      ) : (
        <div className="space-y-3">
          {upcomingAssignments.map((assignment) => (
            <div
              key={assignment.courseId + assignment.title + assignment.dueDate?.year}
              className="border rounded-xl p-4 hover:bg-gray-50 transition"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold">
                    {assignment.title}
                  </h3>

                  <p className="text-sm text-gray-600">
                    {assignment.courseName}
                  </p>

                  <p className="text-sm mt-1">
                    📅 {getDueDate(assignment.dueDate)?.toLocaleDateString() || "No Due Date"}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getUrgencyBadge(assignment.dueDate).className}`}>
                    {getUrgencyBadge(assignment.dueDate).label}
                  </span>

                  <a
                    href={assignment.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 text-sm font-medium"
                  >
                    Open →
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
