const express = require("express");
const { google } = require("googleapis");
const oauth2Client = require("../config/google");

const router = express.Router();

const requireGoogleAuth = async (req, res, next) => {
  if (!req.session.googleTokens) {
    return res.status(401).json({
      error: "Google account not connected",
    });
  }

  oauth2Client.setCredentials(req.session.googleTokens);
  await next();
};

// Login
router.get("/login", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/classroom.courses.readonly",
      "https://www.googleapis.com/auth/classroom.coursework.me.readonly"
    ],
  });

  res.redirect(url);
});

// Callback
router.get("/callback", async (req, res) => {
  try {
    const { code } = req.query;

    const { tokens } =
      await oauth2Client.getToken(code);

    req.session.googleTokens = tokens;

    res.send("Google Classroom Connected!");
  } catch (error) {
    console.error(error);
    res.status(500).send("Connection failed");
  }
});

// Fetch Courses
router.get("/courses", async (req, res) => {
  try {
    await requireGoogleAuth(req, res, async () => {
      const classroom = google.classroom({
        version: "v1",
        auth: oauth2Client,
      });

      const response =
        await classroom.courses.list();

      res.json(response.data);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json(error);
  }
});

router.get("/assignments/:courseId", async (req, res) => {
  try {
    await requireGoogleAuth(req, res, async () => {
      const classroom = google.classroom({
        version: "v1",
        auth: oauth2Client,
      });

      const response =
        await classroom.courses.courseWork.list({
          courseId: req.params.courseId,
        });

      res.json(response.data);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json(error);
  }
});

router.get("/all-assignments", async (req, res) => {
  try {
    await requireGoogleAuth(req, res, async () => {
      const classroom = google.classroom({
        version: "v1",
        auth: oauth2Client,
      });

      const courses =
        await classroom.courses.list({
          courseStates: ["ACTIVE"],
        });

      const allAssignments = [];

      for (const course of courses.data.courses || []) {
        const work =
          await classroom.courses.courseWork.list({
            courseId: course.id,
          });

        (work.data.courseWork || []).forEach(item => {
          allAssignments.push({
            courseName: course.name,
            courseId: course.id,
            title: item.title,
            dueDate: item.dueDate,
            dueTime: item.dueTime,
            state: item.state,
          });
        });
      }

      res.json(allAssignments);
    });
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

module.exports = router;