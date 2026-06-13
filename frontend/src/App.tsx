import { useState, useEffect, useCallback } from "react";
import { loginInstitute, fetchDashboard, logout } from "./services/jportal";
import UpcomingAssignments from "./components/upcomingAssignments";
import "./App.css";

interface Subject {
  subjectcode: string;
  subjectdesc: string;
  employeename: string;
  credits: number;
}

interface ExamEvent {
  exam_event_code: string;
  exam_event_desc: string;
  event_from: number;
}

interface AttendanceStudent {
  subjectcode?: string;
  Ppercentage?: unknown;
  LTpercantage?: unknown;
  Lpercentage?: unknown;
}

interface DashboardData {
  profile: {
  generalinformation: {
    studentname: string;
    branch: string;
    registrationno: string;
    studentid: string;
    sectioncode?: string;
    academicyear?: string;
  };
};
  attendance: {
  meta: unknown | null;
  attendance: { studentattendancelist?: AttendanceStudent[] } | null;
  error?: string | null;
};
  subjects: {
    semester: { registration_code: string };
    subjects: Subject[];
    totalCredits: number;
  };
  exams: {
    semester: { registration_code: string };
    examEvents: ExamEvent[];
  };
}

interface InfoCardProps {
  title: string;
  value?: string | number | null;
}

function getPercentageValue(value: unknown) {
  return typeof value === "number" ? value : 0;
}

function getAttendancePercentage(item: AttendanceStudent) {
  return (
    getPercentageValue(item.Ppercentage) ||
    getPercentageValue(item.LTpercantage) ||
    getPercentageValue(item.Lpercentage) ||
    0
  );
}

function InfoCard({ title, value }: InfoCardProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm text-slate-400">{title}</p>
      <h3 className="mt-2 text-xl font-bold">{value || "N/A"}</h3>
    </div>
  );
}

function App() {
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [password, setPassword] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(
    localStorage.getItem("sessionId")
  );
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  const handleLogout = useCallback(async () => {
    if (sessionId) {
      await logout(sessionId);
    }
    localStorage.removeItem("sessionId");
    setSessionId(null);
    setDashboard(null);
    setEnrollmentNo("");
    setPassword("");
  }, [sessionId]);

  const loadDashboard = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await fetchDashboard(sessionId);
      if (data) {
        setDashboard(data);
      }
    } catch (error) {
      console.error(error);
      await handleLogout();
    } finally {
      setLoading(false);
    }
  }, [handleLogout, sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const timeout = window.setTimeout(() => {
      loadDashboard();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadDashboard, sessionId]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await loginInstitute(enrollmentNo, password);
      if (response.success && response.sessionId) {
        localStorage.setItem("sessionId", response.sessionId);
        setSessionId(response.sessionId);
      }
    } catch (error) {
      console.error(error);
      alert("Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            CampusFlow
          </h1>
          <p className="mt-2 text-slate-400">JIIT Student Portal</p>

          <div className="mt-8 space-y-4">
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
              placeholder="Enrollment Number"
              value={enrollmentNo}
              onChange={(e) => setEnrollmentNo(e.target.value)}
              type="text"
            />
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
            />
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
  <div className="min-h-screen bg-slate-950 text-white">
    <div className="flex">
      
      {/* Sidebar */}
      <aside className="w-72 min-h-screen border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            CampusFlow
          </h1>
        </div>

        <nav className="px-4 space-y-2">
          {[
            ["profile", "👤 Profile"],
            ["attendance", "📊 Attendance"],
            ["subjects", "📚 Subjects"],
            ["exams", "📝 Exams"],
          ].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full rounded-xl px-4 py-3 text-left transition-all ${
                activeTab === tab
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-6 left-4 right-4">
          <button
            onClick={handleLogout}
            className="w-full rounded-xl bg-red-500 px-4 py-3 font-medium hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">
              Welcome Back 👋
            </h2>
            <p className="text-slate-400">
              Student Dashboard
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            Loading...
          </div>
        ) : (
          <>
            {/* Profile */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
                  <div className="flex items-center gap-6">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-3xl font-bold">
                      {dashboard?.profile?.generalinformation?.studentname?.charAt(
                        0
                      )}
                    </div>

                    <div>
                      <h2 className="text-3xl font-bold">
                        {
                          dashboard?.profile?.generalinformation
                            ?.studentname
                        }
                      </h2>
                      <p className="text-slate-400">
                        {
                          dashboard?.profile?.generalinformation
                            ?.branch
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoCard
                    title="Registration No"
                    value={
                      dashboard?.profile?.generalinformation
                        ?.registrationno
                    }
                  />

                  <InfoCard
                    title="Section"
                    value={
                      dashboard?.profile?.generalinformation
                        ?.sectioncode
                    }
                  />

                  <InfoCard
                    title="Academic Year"
                    value={
                      dashboard?.profile?.generalinformation
                        ?.academicyear
                    }
                  />
                </div>

                <UpcomingAssignments />
              </div>
            )}

            {/* Subjects */}
            {dashboard && activeTab === "subjects" && (
              <>
                <div className="mb-6 rounded-3xl bg-gradient-to-r from-indigo-600 to-cyan-600 p-6">
                  <h3 className="text-lg font-medium">
                    Total Credits
                  </h3>
                  <p className="text-4xl font-bold">
                    {dashboard.subjects.totalCredits}
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {dashboard.subjects.subjects?.map(
                    (subject, index) => (
                      <div
                        key={index}
                        className="rounded-3xl border border-slate-800 bg-slate-900 p-6 hover:border-indigo-500 transition"
                      >
                        <h3 className="font-bold text-lg">
                          {subject.subjectcode}
                        </h3>

                        <p className="mt-2 text-slate-400">
                          {subject.subjectdesc}
                        </p>

                        <div className="mt-5 flex justify-between text-sm">
                          <span>
                            {subject.employeename}
                          </span>
                          <span className="font-semibold text-cyan-400">
                            {subject.credits} Credits
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </>
            )}

            {/* Exams */}
            {dashboard && activeTab === "exams" && (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {dashboard.exams.examEvents?.map(
                  (exam, index) => (
                    <div
                      key={index}
                      className="rounded-3xl border border-slate-800 bg-slate-900 p-6"
                    >
                      <h3 className="font-semibold text-lg">
                        {exam.exam_event_desc}
                      </h3>

                      <p className="mt-3 text-slate-400">
                        {exam.exam_event_code}
                      </p>

                      <p className="mt-4 text-cyan-400">
                        📅{" "}
                        {new Date(
                          Number(exam.event_from)
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Attendance */}
            {activeTab === "attendance" && !loading && dashboard && (
  <div>
    <h3 className="text-2xl font-bold mb-4">
      Attendance
    </h3>

    {dashboard.attendance?.attendance?.studentattendancelist?.map(
      (item: any, index: number) => (
        <div
          key={index}
          className="bg-slate-800 p-4 rounded-xl mb-3"
        >
          <h4 className="font-bold">
            {item.subjectcode}
          </h4>

          <p>
            <p>
  Attendance: {
    item.Ppercentage ??
    item.LTpercantage ??
    item.Lpercentage ??
    0
  }%
</p>
          </p>
        </div>
      )
    )}
  </div>
)}
          </>
        )}
      </main>
    </div>
  </div>
);
}

export default App;