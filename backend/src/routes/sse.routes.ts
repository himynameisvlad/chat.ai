import { Router } from 'express';
import { sseController } from '../controllers/sse.controller';
import { cronService } from '../services/cron.service';

const router = Router();

router.get('/connect', (req, res) => sseController.connect(req, res));

router.get('/status', (req, res) => sseController.getStatus(req, res));

router.get('/trigger-toast', async (req, res) => {
  try {
    await cronService.triggerDailyToastNow();
    res.json({
      success: true,
      message: 'Toast triggered successfully'
    });
  } catch (error) {
    console.error('Failed to trigger toast:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger toast'
    });
  }
});

export default router;
