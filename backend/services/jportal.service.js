if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = require("crypto").webcrypto;
}

if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}

const { WebPortal } = require("jsjiit");

const portalSessions = new Map();

async function getPortal(sessionId) {
  if (!portalSessions.has(sessionId)) {
    throw new Error("Session not found. Please login again.");
  }
  return portalSessions.get(sessionId);
}

async function loginInstitute(enrollmentNo, password, sessionId) {
  const portal = new WebPortal({
    useProxy: true,
    proxyUrl: "http://localhost:5002"
  });
  
  const session = await portal.student_login(
    enrollmentNo,
    password,
    { captcha: "phw5n", hidden: "gmBctEffdSg=" }
  );

  portalSessions.set(sessionId, portal);

  const profile = await portal.get_personal_info();

  return {
    success: true,
    profile,
    instituteid: session.instituteid,
    enrollmentNo: session.enrollmentno,
    sessionId
  };
}

async function fetchDashboard(sessionId) {
  const portal = await getPortal(sessionId);
  
  const [attendance, subjects, exams] = await Promise.all([
    fetchAttendance(portal),
    fetchSubjects(portal),
    fetchExams(portal)
  ]);
  
  let profile = null;
  let feeSummary = null;
  let sgpaCgpa = null;
  
  try {
    profile = await portal.get_personal_info();
  } catch (err) {
    console.error("get_personal_info failed:", err.message);
  }
  
  try {
    feeSummary = await portal.get_fee_summary();
  } catch (err) {
    console.error("get_fee_summary failed:", err.message);
  }
  
  try {
    sgpaCgpa = await portal.get_sgpa_cgpa();
  } catch (err) {
    console.error("get_sgpa_cgpa failed:", err.message);
  }

  return {
    profile,
    attendance,
    subjects,
    exams,
    feeSummary,
    sgpaCgpa
  };
}

async function fetchAttendance(portal) {
  try {
    const meta = await portal.get_attendance_meta();
    const latestHeader = meta?.latest_header?.();
    const latestSemester = meta?.latest_semester?.();

    if (!latestHeader || !latestSemester) {
      return {
        meta: meta || null,
        attendance: null
      };
    }

    const attendance = await portal.get_attendance(latestHeader, latestSemester);

    return {
      meta: meta,
      attendance: attendance
    };
  } catch (err) {
    console.error("fetchAttendance failed:", err.message);
    return {
      meta: null,
      attendance: null
    };
  }
}

async function fetchSubjects(portal) {
  try {
    const semesters = await portal.get_registered_semesters();
    const latestSemester = Array.isArray(semesters) && semesters.length > 0 ? semesters[0] : null;

    if (!latestSemester) {
      return {
        semester: null,
        subjects: [],
        totalCredits: 0
      };
    }

    const registrations = await portal.get_registered_subjects_and_faculties(latestSemester);

    return {
      semester: latestSemester,
      subjects: Array.isArray(registrations?.subjects) ? registrations.subjects : [],
      totalCredits: typeof registrations?.total_credits === 'number' ? registrations.total_credits : 0
    };
  } catch (err) {
    console.error("fetchSubjects failed:", err.message);
    return {
      semester: null,
      subjects: [],
      totalCredits: 0
    };
  }
}

async function fetchExams(portal) {
  try {
    const examSemesters = await portal.get_semesters_for_exam_events();
    const latestSemester = Array.isArray(examSemesters) && examSemesters.length > 0 ? examSemesters[0] : null;

    if (!latestSemester) {
      return {
        semester: null,
        examEvents: []
      };
    }

    const examEvents = await portal.get_exam_events(latestSemester);

    return {
      semester: latestSemester,
      examEvents: examEvents
    };
  } catch (err) {
    console.error("fetchExams failed:", err.message);
    return {
      semester: null,
      examEvents: []
    };
  }
}

async function logout(sessionId) {
  portalSessions.delete(sessionId);
}

module.exports = {
  loginInstitute,
  fetchDashboard,
  fetchAttendance,
  fetchSubjects,
  fetchExams,
  logout
};
