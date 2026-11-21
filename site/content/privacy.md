---
slug: "privacy"
title: "Privacy Policy"
description: "How Ruminate stores your data, handles optional sync, and respects your analytics preference."
---

Effective date: September 27, 2026

Ruminate is an open-source Bible memory app built with privacy and data ownership as core priorities. This policy explains how your data is handled.

---

## Data Storage

All your data — verses, collections, memorization progress, and settings — is stored locally on your device using your browser's localStorage. No data is sent to or stored on any Ruminate server. The app is a static website with no backend database.

## Sync Providers (Optional)

You may optionally configure a sync provider to keep your data in sync across devices. Sync is entirely opt-in and disabled by default.

- **WebDAV:** Your data is synced directly between your browser and your own WebDAV server. Ruminate does not have access to your WebDAV credentials or data.
- **Google Drive:** If you choose to sign in with Google, Ruminate uses the `drive.file` scope, which only allows access to files that the app itself creates. Ruminate cannot read, modify, or delete any other files in your Google Drive. Your data is stored in a `rum1n8` folder in your Drive; this folder name is retained as a compatibility identifier. No Google tracking scripts or SDKs are loaded — authentication uses a standard OAuth redirect and direct API calls.

## Third-Party Services

The marketing website may use a self-hosted instance of Umami for aggregate usage analytics. It does not use advertising trackers or third-party tracking cookies.

- The app and marketing site use separate analytics website entries.
- Their opt-out preferences are independent because the two sites live on separate origins.

::: analytics-preference

## Data You Control

You can export all your data at any time using the Backup & Restore feature. You can also delete all app data by clearing your browser's site data. If you use Google Drive sync, you can revoke access at any time from your [Google Account permissions](https://myaccount.google.com/permissions) and delete the `rum1n8` folder from your Drive.

## Children's Privacy

Ruminate does not knowingly collect any personal information from anyone, including children under 13. The app has no user accounts, registration, or data collection mechanisms.

## Changes to This Policy

If this policy is updated, the changes will be reflected on this page with an updated effective date. Since Ruminate does not collect email addresses, users are encouraged to review this policy periodically.

## Contact

For questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/timunrau/rum1n8).
