const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const session = require("express-session");
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed for origin: " + origin));
    }
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "x-session-id"]
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("CampusFlow Backend Running");
});

app.use(
  "/api/jportal",
  require("./routes/jportal.routes")
);

app.use(
  "/api/classroom",
  require("./routes/classroom")
);

app.use(
  "/api/ai",
  require("./routes/ai.routes")
);

const PORT = 5001;

app.listen(PORT, () => {
  console.log(`CampusFlow backend running on port ${PORT}`);
});
