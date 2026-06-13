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

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
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

const PORT = 5001;

app.listen(PORT, () => {
  console.log(`CampusFlow backend running on port ${PORT}`);
});
