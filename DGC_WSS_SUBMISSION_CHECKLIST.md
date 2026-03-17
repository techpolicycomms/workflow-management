# DGC/WSS Submission Checklist

Use this checklist before sharing the prototype with DGC/WSS for review.

## 1) Scope and Deliverables

- [ ] Link to running prototype or hosted preview
- [ ] Repository URL and release tag reference
- [ ] Wireframes or final UI screenshots
- [ ] Feature summary and non-goals

## 2) UN/ITU Brand Alignment

- [ ] ITU/UN brand usage reviewed against approved guidance
- [ ] Color palette and typography reviewed by communications/design focal point
- [ ] Header and identity treatment approved
- [ ] Brand assets licensed and sourced from approved channels

## 3) Multilingualism

- [ ] All static UI strings provided in: Arabic, Chinese, English, French, Russian, Spanish
- [ ] Language bar order: عربي 中文 English Français Русский Español
- [ ] Human-reviewed translations (no machine-only production copy)
- [ ] Arabic RTL rendering tested end-to-end
- [ ] i18n validation report exported and attached

## 4) Accessibility (WCAG-Oriented)

- [ ] Keyboard-only navigation complete for all core flows
- [ ] Focus indicators visible on all interactive controls
- [ ] Color contrast tested on primary and secondary text
- [ ] Reduced motion preference handled
- [ ] Screen reader smoke test completed for form and action workflows

## 5) Workflow and Governance Controls

- [ ] Approval chain edits are logged in audit history
- [ ] OOO/departed-user resolution paths are recorded
- [ ] Role-based and person-based approvals both tested
- [ ] Exported audit sample attached

## 6) Backend Operational Readiness

- [ ] Supabase schema applied successfully (`supabase-schema.sql`)
- [ ] CRUD path validated in Supabase mode
- [ ] Local fallback mode validated without Supabase
- [ ] Local AI proxy tested via `http://127.0.0.1:8787/health`
- [ ] Secrets stored locally only (`.env.local` not committed)

## 7) Evidence Package for DGC/WSS

- [ ] `README.md` with setup and governance notes
- [ ] i18n validation report file
- [ ] Accessibility test notes
- [ ] Screenshots for desktop + mobile + RTL
- [ ] Open issues/risk register with mitigations

## 8) Sign-off Metadata

- Submission owner:
- Date:
- Release tag:
- Environment tested:
- Known limitations:
