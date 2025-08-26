import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";

// Files import

import weatherRouter from "./route/weather.route.js";
import stayRouter from "./route/stay.route.js";

const app = express();

app.use(morgan("dev"));

app.use(cookieParser());
app.use(express.json({ limit: "16kb" }));
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.get("/", (req, res) => {
  res.json("hello");
});

app.use("/api/weather", weatherRouter);
app.use("/api/stay", stayRouter);
export { app };
