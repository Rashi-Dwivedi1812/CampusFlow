const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const {
  loginInstitute,
  fetchDashboard,
  fetchAttendance,
  fetchSubjects,
  fetchExams,
  logout
} = require("../services/jportal.service");

router.post("/login", async (req, res) => {
  try {
    const { enrollmentNo, password } = req.body;

    if (!enrollmentNo || !password) {
      return res.status(400).json({
        success: false,
        message: "Enrollment number and password are required"
      });
    }

    const sessionId = uuidv4();
    const result = await loginInstitute(enrollmentNo, password, sessionId);

    res.json({
      success: true,
      sessionId,
      profile: result.profile
    });

  } catch (error) {
    const details = {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    };
    console.error("Login failed:", details);
    res.status(500).json({
      success: false,
      message: error.message || "Login failed",
      details
    });
  }
});

router.post("/dashboard", async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "sessionId is required"
      });
    }
    
    const dashboard = await fetchDashboard(sessionId);
    res.json({
      success: true,
      dashboard
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch dashboard"
    });
  }
});

router.post("/attendance", async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    const dashboard = await fetchDashboard(sessionId);
    res.json({
      success: true,
      attendance: dashboard.attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch attendance"
    });
  }
});

router.post("/subjects", async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    const dashboard = await fetchDashboard(sessionId);
    res.json({
      success: true,
      subjects: dashboard.subjects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch subjects"
    });
  }
});

router.post("/exams", async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    const dashboard = await fetchDashboard(sessionId);
    res.json({
      success: true,
      exams: dashboard.exams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch exams"
    });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    await logout(sessionId);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Logout failed"
    });
  }
});

module.exports = router;
