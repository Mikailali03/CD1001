import { Router, type IRouter } from "express";
import healthRouter from "./health";
import propertiesRouter from "./properties";
import assetsRouter from "./assets";
import serviceRecordsRouter from "./service_records";
import maintenanceRouter from "./maintenance";
import guidesRouter from "./guides";
import marketplaceRouter from "./marketplace";
import dashboardRouter from "./dashboard";
import scoutRouter from "./scout";
import lensRouter from "./lens";
import capitalRouter from "./capital";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scoutRouter);
router.use(lensRouter);
router.use(capitalRouter);
router.use(propertiesRouter);
router.use(assetsRouter);
router.use(serviceRecordsRouter);
router.use(maintenanceRouter);
router.use(guidesRouter);
router.use(marketplaceRouter);
router.use(dashboardRouter);

export default router;
