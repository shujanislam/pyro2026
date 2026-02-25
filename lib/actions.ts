// ─────────────────────────────────────────────────────────────────────────────
// actions.ts — thin facade; all logic lives in lib/actions/
// ─────────────────────────────────────────────────────────────────────────────
export { analyzeBloodReportBuffer }                                  from './actions/blood.ts'
export { analyzeMedicalDocument, analyzeMedicalDocumentBuffer }     from './actions/medical.ts'
export { analyzeMedicalInsuranceDocs, analyzeMedicalInsuranceBuffer } from './actions/insurance.ts'
export { answerFollowUpQuestion, compareReports }                   from './actions/followup.ts'
