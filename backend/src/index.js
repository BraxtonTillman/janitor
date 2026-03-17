import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import scoreRouter from "./routes/score.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" })); // tighten this in production
app.use(express.json());

app.use("/api/score", scoreRouter);

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`Janitor backend running on http://localhost:${PORT}`);
});
