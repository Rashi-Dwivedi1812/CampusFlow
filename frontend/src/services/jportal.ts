import axios from "axios";

const API =
"http://localhost:5001/api/jportal";

export const loginInstitute = async (
  enrollmentNo:string,
  password:string
) => {

  const response =
  await axios.post(
    `${API}/login`,
    {
      enrollmentNo,
      password
    }
  );

  return response.data;
};

export const fetchDashboard = async (
  sessionId: string
) => {
  const response =
    await axios.post(
      `${API}/dashboard`,
      { sessionId }
    );

  if (response.data.success) {
    return response.data.dashboard;
  }

  throw new Error(response.data.message || "Failed to fetch dashboard");
};

export const fetchAttendance = async (
  sessionId: string
) => {
  const response =
    await axios.post(
      `${API}/dashboard`,
      { sessionId }
    );

  if (response.data.success) {
    return response.data.dashboard.attendance;
  }

  throw new Error(response.data.message || "Failed to fetch attendance");
};

export const fetchSubjects = async (
  sessionId: string
) => {
  const response =
    await axios.post(
      `${API}/dashboard`,
      { sessionId }
    );

  if (response.data.success) {
    return response.data.dashboard.subjects;
  }

  throw new Error(response.data.message || "Failed to fetch subjects");
};

export const fetchExams = async (
  sessionId: string
) => {
  const response =
    await axios.post(
      `${API}/dashboard`,
      { sessionId }
    );

  if (response.data.success) {
    return response.data.dashboard.exams;
  }

  throw new Error(response.data.message || "Failed to fetch exams");
};

export const logout = async (
  sessionId: string
) => {
  try {
    const response = await axios.post(
      `${API}/logout`,
      { sessionId }
    );
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

