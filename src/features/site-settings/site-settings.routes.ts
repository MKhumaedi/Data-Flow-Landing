import { Router } from 'express';
import { siteSettingsController } from './site-settings.controller';

const publicRouter = Router();
publicRouter.get('/integrations', (req, res, next) => siteSettingsController.getPublicIntegrations(req, res, next));

export const publicSiteSettingsRoutes = publicRouter;
