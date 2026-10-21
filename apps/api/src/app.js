import cors from "cors";
import express from "express";
import multer from "multer";
import { webOrigin } from "./config/index.js";
import apiRouter from "./routes/index.js";

const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: webOrigin, credentials: true }));
app.use(express.json({ limit: "32kb" }));

// Mount central API router under /api
app.use("/api", apiRouter);

// Global Error Handler
app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Each product image must be 8 MB or smaller."
        : "Upload up to five JPG, PNG, or WebP product images.";
    return response.status(400).json({ message });
  }
  if (error instanceof SyntaxError && error.status === 400) {
    return response.status(400).json({ message: "Invalid JSON body." });
  }
  if (error.statusCode) {
    return response.status(error.statusCode).json({ message: error.message });
  }
  console.error(error);
  response.status(500).json({ message: "Unexpected server error." });
});

export default app;
