# Frontend

Next.js 15+ admin UI scaffold for the internal server maintenance platform.

## Current scope

- App Router structure
- Login page shell
- Dashboard shell
- Add Server wizard shell
- Server detail shell
- Settings shell
- Shared API and environment utilities
- Tailwind and shadcn-compatible base setup

## Product alignment

- Auth starts with a dedicated login page
- Add Server flow is SSH-first
- Provider metadata from Akamai or DigitalOcean is read-only operational context
- WordOps inspection and health checks are first-class concepts in the UI
- UI language reflects incidents, remediations, and audit logging as first-class concepts

## Routes

- `/login`
- `/dashboard`
- `/servers/new`
- `/servers/[id]`
- `/settings`

## Environment

Copy `.env.example` to `.env.local`:

- `NEXT_PUBLIC_API_BASE_URL`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`

## Notes

- This pass focuses on scaffolding and shells, not a full auth implementation.
- UI components are lightweight and compatible with a later shadcn expansion.
