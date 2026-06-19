import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { uploadResume } from '../middleware/upload.middleware.js';
import {
  createAnalysis,
  getAnalysis,
  listAnalyses,
  deleteAnalysis,
  generateQuestions,
  generateRoadmap,
  exportPDF,
  exportCSV,
} from '../controllers/analysis.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', uploadResume, createAnalysis);
router.get('/', listAnalyses);
router.get('/:id', getAnalysis);
router.delete('/:id', deleteAnalysis);
router.post('/:id/generate-questions', generateQuestions);
router.post('/:id/generate-roadmap', generateRoadmap);
router.get('/:id/export/pdf', exportPDF);
router.get('/:id/export/csv', exportCSV);

export default router;
