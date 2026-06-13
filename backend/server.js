const express = require("express");
const cors = require("cors");

const app = express();

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

const PORT = 5001;

app.listen(PORT, () => {
  console.log(`CampusFlow backend running on port ${PORT}`);
});
