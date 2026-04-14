# Canva Board Index

## Purpose

Canva is the primary visual planning and mockup surface for Identity Manager. Because no brand kit is connected yet, the first deliverable is a manual board structure based on `vault-themes` semantic tokens and the brand foundation in this program pack.

## Board Structure

### Board 01: Brand Foundation

Pages:

1. product thesis and tone words
2. competitor feel audit
3. color direction and token candidates
4. typography and icon direction
5. motion and interaction principles

### Board 02: Navigation and Information Architecture

Pages:

1. extension popup IA
2. full vault IA
3. desktop IA
4. iOS IA
5. Android IA
6. settings, recovery, and device-management IA

### Board 03: Critical Journeys

Pages:

1. first run and account creation
2. PIN setup and unlock
3. sign-up detection and new identity offer
4. login detection and existing identity suggestion
5. device approval
6. recovery kit export/import

### Board 04: Extension Screens

Pages:

1. popup overview
2. signup suggestion sheet
3. login suggestion sheet
4. quick password / TOTP actions
5. full vault browser tab
6. settings and lock states

### Board 05: Desktop Screens

Pages:

1. desktop dashboard shell
2. vault list/detail
3. generated persona detail and artifacts
4. device management
5. recovery flows

### Board 06: iOS Screens

Pages:

1. app shell
2. vault list/detail
3. Password AutoFill suggestion states
4. unlock and recovery
5. settings and devices

### Board 07: Android Screens

Pages:

1. app shell
2. vault list/detail
3. AutofillService suggestion states
4. unlock and recovery
5. settings and devices

### Board 08: Encryption and Recovery Diagrams

Pages:

1. human-readable encryption overview
2. device add and approval
3. recovery kit lifecycle
4. sync conflict states
5. lock/relock behavior

## Required Review Order

1. Brand Foundation
2. Navigation and Information Architecture
3. Critical Journeys
4. Extension Screens
5. Desktop / iOS / Android shells
6. Encryption and Recovery Diagrams

## Annotation Rules

- annotate screens with semantic token names, not raw hex values
- mark trust-critical states explicitly
- label whether a screen is extension, desktop, iOS, or Android
- identify interactive states: idle, loading, success, blocked, risk, locked

## Handoff Rules

- every screen should identify the related journey and epic
- every critical screen should include at least one implementation note
- every recovery/encryption screen should be reviewed against ADR-002 before approval
