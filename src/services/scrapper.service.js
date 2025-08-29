import { stayService } from "./stays.services.js";
export const backGroundScraping = async (source) => {
  try {
    if (source === "airbnb") {
      console.log("Starting airbnb scrapping in the background");
      await stayService();
      // TODO: added it for booking and other scrapper also
    } else if (source === "hotels") {
      console.log("started refreshing data for hotels");
    } else {
      throw new Error("No score given");
    }

    return {
      success: true,
      message: "Background refresh completed",
    };
  } catch (error) {
    console.error("error in background scraping");
    return {
      success: true,
      error: error.message,
      message: "Background scraping failed",
    };
  }
};

export const performScraping = async (source) => {
  let data;
  console.log(
    `🔄 Performing immediate scraping for city: dehradun from ${source}...`
  );

  try {
    if ((source = "airbnb")) {
      data = await stayService();
      if (data.length > 0) {
        return data;
      }
    }
  } catch (error) {
    console.error("error in background scraping");
    return {
      success: true,
      error: error.message,
      message: "Background scraping failed",
    };
  }
};
