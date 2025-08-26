import { Router } from "express";

import { getStays } from "../controller/stay.controller.js";

const router = Router();

router.get("/", getStays);

export default router;
