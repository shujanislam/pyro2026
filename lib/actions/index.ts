// Re-export all actions — existing imports from 'lib/actions.ts' still work
export { analyzeBloodReportBuffer }           from './blood.ts'
export { analyzeMedicalDocument, analyzeMedicalDocumentBuffer } from './medical.ts'
export { analyzeMedicalInsuranceDocs, analyzeMedicalInsuranceBuffer } from './insurance.ts'
export { answerFollowUpQuestion, compareReports } from './followup.ts'
