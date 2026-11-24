import { Router } from 'express';
import healthRouter from './health.js';
import salonRouter from './salon.js';
import servicesRouter from './services.js';
import barbersRouter from './barbers.js';
import queueRouter from './queue.js';
import receptionRouter from './reception.js';
import barbersViewRouter from './barbersView.js';
import displayRouter from './display.js';
import adminRouter from './admin.js';

const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(salonRouter);
apiRouter.use(servicesRouter);
apiRouter.use(barbersRouter);
apiRouter.use(queueRouter);
apiRouter.use(receptionRouter);
apiRouter.use(barbersViewRouter);
apiRouter.use(displayRouter);
apiRouter.use(adminRouter);

export default apiRouter;
