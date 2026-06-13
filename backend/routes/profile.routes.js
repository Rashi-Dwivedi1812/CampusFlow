const express = require("express");

const router = express.Router();

const {
  getStudentProfile
} = require("../services/jportal.service");

router.get("/", async (req, res) => {

  try {

    const token =
      req.headers.authorization?.split(" ")[1];

    const data =
      await getStudentProfile(
        token
      );

    res.json(data);

  } catch (error) {

    console.log(error.response?.data);

    res.status(500).json({
      message: "Failed"
    });
  }
});

module.exports = router;