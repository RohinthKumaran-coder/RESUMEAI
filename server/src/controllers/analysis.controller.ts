import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { db } from '../lib/store.js';
import { AppError } from '../middleware/error.middleware.js';
import { parseResumePDF, deleteFile } from '../services/resume-parser.service.js';
import { aiService } from '../services/ai.service.js';
import { analyzeSkillGap } from '../services/skill-gap.service.js';
import { generatePDFReport } from '../services/pdf-report.service.js';
import { generateCSVReport } from '../services/csv-export.service.js';
import { ROLE_SKILLS, SUPPORTED_ROLES } from '../data/role-skills.js';
import type { SupportedRole, AnalysisResponse } from '../types/index.js';
import type { AnalysisRecord } from '../lib/store.js';

function shapeAnalysis(record: AnalysisRecord): AnalysisResponse {
  return {
    id: record.id,
    userId: record.userId,
    targetRole: record.targetRole,
    resumeFileName: record.resumeFileName,
    candidateName: record.candidateName,
    candidateEmail: record.candidateEmail,
    candidatePhone: record.candidatePhone,
    education: (record.education as AnalysisResponse['education']) || [],
    experience: (record.experience as AnalysisResponse['experience']) || [],
    projects: (record.projects as AnalysisResponse['projects']) || [],
    certifications: (record.certifications as AnalysisResponse['certifications']) || [],
    extractedSkills: record.extractedSkills || [],
    matchedSkills: record.matchedSkills || [],
    missingSkills: record.missingSkills || [],
    readinessScore: record.readinessScore || 0,
    candidateSummary: record.candidateSummary,
    learningResources: (record.learningResources as AnalysisResponse['learningResources']) || [],
    interviewQuestions: (record.interviewQuestions as AnalysisResponse['interviewQuestions']) || null,
    preparationRoadmap: (record.preparationRoadmap as AnalysisResponse['preparationRoadmap']) || null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const createAnalysis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let filePath: string | undefined;
  try {
    if (!req.file) throw new AppError('Please upload a resume PDF file.', 400);

    const { targetRole } = req.body;
    if (!targetRole) throw new AppError('Please select a target role.', 400);
    if (!SUPPORTED_ROLES.includes(targetRole as SupportedRole)) throw new AppError(`Unsupported role: ${targetRole}`, 400);

    filePath = path.resolve(req.file.path);
    const userId = req.user!.id;

    const resumeText = await parseResumePDF(filePath);
    const profile = await aiService.extractResumeData(resumeText);
    const skillGap = analyzeSkillGap(profile.skills, targetRole);

    const [summary, resources, questions, roadmap] = await Promise.allSettled([
      aiService.generateCandidateSummary(profile, targetRole),
      aiService.generateLearningResources(skillGap.missingSkills, targetRole),
      aiService.generateInterviewQuestions(profile, targetRole, skillGap.matchedSkills, skillGap.missingSkills),
      aiService.generatePreparationRoadmap(skillGap.missingSkills, skillGap.matchedSkills, targetRole),
    ]);

    const analysis = db.analysis.create({
      userId,
      targetRole,
      resumeFileName: req.file.originalname,
      resumeText,
      candidateName: profile.name,
      candidateEmail: profile.email,
      candidatePhone: profile.phone,
      education: profile.education,
      experience: profile.experience,
      projects: profile.projects,
      certifications: profile.certifications,
      extractedSkills: profile.skills,
      matchedSkills: skillGap.matchedSkills,
      missingSkills: skillGap.missingSkills,
      readinessScore: skillGap.readinessScore,
      candidateSummary: summary.status === 'fulfilled' ? summary.value : null,
      learningResources: resources.status === 'fulfilled' ? resources.value : [],
      interviewQuestions: questions.status === 'fulfilled' ? questions.value : null,
      preparationRoadmap: roadmap.status === 'fulfilled' ? roadmap.value : null,
    });

    deleteFile(filePath);

    res.status(201).json({
      success: true,
      data: shapeAnalysis(analysis),
      message: 'Resume analyzed successfully!',
    });
  } catch (error) {
    if (filePath) deleteFile(filePath);
    next(error);
  }
};

export const getAnalysis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const analysis = db.analysis.findById(id);
    if (!analysis) throw new AppError('Analysis not found.', 404);
    if (analysis.userId !== userId) throw new AppError('Not authorized.', 403);
    res.json({ success: true, data: shapeAnalysis(analysis) });
  } catch (error) {
    next(error);
  }
};

export const listAnalyses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const analyses = db.analysis.findByUser(userId);
    res.json({ success: true, data: analyses.map(shapeAnalysis) });
  } catch (error) {
    next(error);
  }
};

export const deleteAnalysis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const analysis = db.analysis.findById(id);
    if (!analysis) throw new AppError('Analysis not found.', 404);
    if (analysis.userId !== userId) throw new AppError('Not authorized.', 403);
    db.analysis.delete(id);
    res.json({ success: true, message: 'Analysis deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

export const generateQuestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const analysis = db.analysis.findById(id);
    if (!analysis) throw new AppError('Analysis not found.', 404);
    if (analysis.userId !== userId) throw new AppError('Not authorized.', 403);

    const profile = {
      name: analysis.candidateName || '',
      email: analysis.candidateEmail || '',
      phone: analysis.candidatePhone || '',
      skills: analysis.extractedSkills || [],
      education: (analysis.education as AnalysisResponse['education']) || [],
      experience: (analysis.experience as AnalysisResponse['experience']) || [],
      projects: (analysis.projects as AnalysisResponse['projects']) || [],
      certifications: (analysis.certifications as AnalysisResponse['certifications']) || [],
    };

    const questions = await aiService.generateInterviewQuestions(
      profile, analysis.targetRole, analysis.matchedSkills, analysis.missingSkills
    );

    const updated = db.analysis.update(id, { interviewQuestions: questions });
    res.json({ success: true, data: shapeAnalysis(updated!) });
  } catch (error) {
    next(error);
  }
};

export const generateRoadmap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const analysis = db.analysis.findById(id);
    if (!analysis) throw new AppError('Analysis not found.', 404);
    if (analysis.userId !== userId) throw new AppError('Not authorized.', 403);

    const roadmap = await aiService.generatePreparationRoadmap(
      analysis.missingSkills, analysis.matchedSkills, analysis.targetRole
    );

    const updated = db.analysis.update(id, { preparationRoadmap: roadmap });
    res.json({ success: true, data: shapeAnalysis(updated!) });
  } catch (error) {
    next(error);
  }
};

export const exportPDF = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const analysis = db.analysis.findById(id);
    if (!analysis) throw new AppError('Analysis not found.', 404);
    if (analysis.userId !== userId) throw new AppError('Not authorized.', 403);
    const pdfBuffer = await generatePDFReport(shapeAnalysis(analysis));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resumeiq-report-${id.slice(0, 8)}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

export const exportCSV = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const analysis = db.analysis.findById(id);
    if (!analysis) throw new AppError('Analysis not found.', 404);
    if (analysis.userId !== userId) throw new AppError('Not authorized.', 403);
    const csv = generateCSVReport(shapeAnalysis(analysis));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="resumeiq-skills-${id.slice(0, 8)}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

export const getRoles = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roles = SUPPORTED_ROLES.map((role) => ({
      id: role,
      name: role,
      description: ROLE_SKILLS[role as SupportedRole].description,
      requiredSkillsCount: ROLE_SKILLS[role as SupportedRole].requiredSkills.length,
      skills: ROLE_SKILLS[role as SupportedRole].requiredSkills,
    }));
    res.json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
};