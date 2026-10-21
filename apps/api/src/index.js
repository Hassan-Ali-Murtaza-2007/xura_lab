import app from "./app.js";
import { port } from "./config/index.js";

app.listen(port, () => {
  console.log(`Xura Lab API listening on http://localhost:${port}`);
});
