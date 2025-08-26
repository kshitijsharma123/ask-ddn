import { stayService } from "../services/stays.services.js";
import { saveScrapedStays } from "../utils/stay.utils.js";

export const getStays = async (req, res) => {
  const { city } = req.query;

  console.log(city);
  const data = await stayService(city);
  await saveScrapedStays(data);

  //   console.log(data);
  return res.json({
    data,
    message: "working",
  });
};
