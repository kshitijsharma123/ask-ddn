import { Router } from "express";

import { getStaysAirbnb } from "../controller/stay.controller.js";

const router = Router();

router.get("/airbnb", getStaysAirbnb);

export default router;
