import { Router } from "express";
import adminAuthRoutes from "./admin-auth.routes.js";
import adminDashboardRoutes from "./admin-dashboard.routes.js";
import adminOrdersRoutes from "./admin-orders.routes.js";
import adminProductsRoutes from "./admin-products.routes.js";
import adminPromosRoutes from "./admin-promos.routes.js";
import storefrontRoutes from "./storefront.routes.js";

const apiRouter = Router();

// Admin routes mounted under /api/admin
apiRouter.use("/admin", adminAuthRoutes);
apiRouter.use("/admin", adminDashboardRoutes);
apiRouter.use("/admin", adminOrdersRoutes);
apiRouter.use("/admin", adminProductsRoutes);
apiRouter.use("/admin", adminPromosRoutes);

// Storefront & public routes mounted under /api
apiRouter.use("/", storefrontRoutes);

export default apiRouter;
