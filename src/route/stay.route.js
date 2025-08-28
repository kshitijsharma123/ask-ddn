import { Router } from "express";

import { getStaysAirbnb, getHotels } from "../controller/stay.controller.js";

const router = Router();

router.get("/airbnb", getStaysAirbnb);
router.get("/hotel", getHotels);

export default router;
