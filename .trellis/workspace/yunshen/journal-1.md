# Journal - yunshen (Part 1)

> AI development session journal
> Started: 2026-08-29

---



## Session 1: Build ofox-video-core, seedance-short-drama, seedance-ad-creative skills

**Date**: 2026-08-29
**Task**: Build ofox-video-core, seedance-short-drama, seedance-ad-creative skills
**Branch**: `main`

### Summary

Shipped v1 of the Seedance 2.5 execution-layer skills: ofox-video-core (shared script wrapping the Ofox video API: create/poll/download/cost report, no-resubmit-on-timeout rule) plus two scenario skills (seedance-short-drama, seedance-ad-creative) that delegate to it. Real paid end-to-end tests ($1.32 total) confirmed the pipeline and caught a real bug: completed jobs don't reliably include mirror_urls, only unsigned_urls -- fixed with a fallback and captured in a new .trellis/spec/skills/ layer for future scenario skills.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e834198` | (see git log) |
| `a968012` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
