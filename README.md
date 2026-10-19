# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Settlement chain: Stellar (Base is retired)

As of 2026-10-19 MicroCrop no longer uses Base. Stellar (Soroban) is the only chain MicroCrop
records on, and MicroCrop never handles funds: the insurer collects premiums and settles claims,
and MicroCrop verifies and records the outcome.

Phase 1 switches Base off reversibly. Nothing EVM is deleted and legacy Base records stay
readable, but every Base-only surface is hidden behind one build-time switch:

| Variable | Default | Effect |
| --- | --- | --- |
| `VITE_BASE_SETTLEMENT_ENABLED` | unset (off) | `"true"` restores the Base surfaces: org wallet provisioning, the on-chain reserve ratio and reserve read, the platform Treasury page, BaseScan links. Turn it on only together with the backend's `BASE_SETTLEMENT_ENABLED`, or every Base action answers `409 BASE_RETIRED`. |
| `VITE_STELLAR_NETWORK` | `testnet` | `testnet` or `public`: the stellar.expert network used when a record does not name its own. A notary receipt's own network always wins. |
| `VITE_EXPLORER_BASE_URL` | `https://basescan.org` | BaseScan origin for legacy links; used only with the switch on. |

Explorer links live in `src/lib/explorer.ts`. The EVM-era guides under `docs/` (pools, wallets,
deposits) are marked historical.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
