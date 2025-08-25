import { Router } from "express";

import { fetchWeather } from "../controller/weather.controller.js";

const router = Router();

router.get("/", fetchWeather);

export default router;
