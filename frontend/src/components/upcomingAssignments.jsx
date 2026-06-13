import { useEffect, useState } from "react";
import axios from "axios";

export default function UpcomingAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

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
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatDueDate = (dueDate) => {
    if (!dueDate) return "No Due Date";

    return new Date(
      dueDate.year,
      dueDate.month - 1,
      dueDate.day
    ).toLocaleDateString();
  };

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
          {assignments.length} Total
        </span>
      </div>

      {assignments.length === 0 ? (
        <p className="text-gray-500">
          No assignments found.
        </p>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment, index) => (
            <div
              key={index}
              className="border rounded-xl p-4 hover:bg-gray-50 transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">
                    {assignment.title}
                  </h3>

                  <p className="text-sm text-gray-600">
                    {assignment.courseName}
                  </p>

                  <p className="text-sm mt-1">
                    📅 {formatDueDate(assignment.dueDate)}
                  </p>
                </div>

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
          ))}
        </div>
      )}
    </div>
  );
}