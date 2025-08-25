import { app } from "./app.js";
import { connectDB } from "./config/db.js";
const PORT = process.env.PORT || 5400;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log({ serverLive: true, PORT });
  });
});
