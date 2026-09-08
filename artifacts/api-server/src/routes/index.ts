import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import permissionsRouter from "./permissions";
import activityRouter from "./activity";
import studentsRouter from "./students";
import storageRouter from "./storage";
import commercialRouter from "./commercial";
import financialRouter from "./financial";
import teamRouter from "./team";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(permissionsRouter);
router.use(activityRouter);
router.use(studentsRouter);
router.use(storageRouter);
router.use(commercialRouter);
router.use(financialRouter);
router.use(teamRouter);

export default router;
