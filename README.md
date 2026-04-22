# Project 5: Vulnerable Browser Extension

Team Members:
- Maret Rudin-Aulenbach
- Jimmy Baek
- Juan Guerrero

This repository contains a framework for a Chrome browser extension that summarizes page content and demonstrates two intentional vulnerabilities, plus a defended version.

## Project Structure

- `vulnerable/` - Intentionally insecure implementation used to demonstrate attacks.
- `secure/` - Defended implementation with mitigations.

Each folder is a standalone Manifest V3 Chrome extension and can be loaded independently in Developer Mode.

## Learning Goals

1. Show how insecure cross-context messaging can leak private extension data.
2. Show how summarizing too much page content can accidentally collect secrets.
3. Demonstrate practical defenses: strict message validation, least privilege, and safer UX.

## Attack 1: Message-Based History Exfiltration

### Vulnerable Behavior
- The extension stores summary history in local extension storage.
- It listens to `window.postMessage` requests from any page origin.
- It returns all stored history to whatever page requested it.

A malicious site can call `window.postMessage(...)` and retrieve a user’s summary history.

### Defense
- Remove broad message exposure to page scripts.
- Validate sender and message origin strictly.
- Restrict history access to extension UI only.

## Attack 2: Over-Collection of Sensitive DOM Data

### Vulnerable Behavior
- The extension summarizes all visible and hidden DOM content.
- This can include sensitive values (password fields, tokens, account information).
- The sensitive summary is stored in history.

Combined with Attack 1, an attacker can exfiltrate sensitive data indirectly.

### Defense
- Require explicit user selection before summarization.
- Summarize only selected text.
- Warn users to avoid selecting sensitive information.

## Secure Design Principles Included

- Strict origin and sender validation for messaging.
- Narrow permission scopes.
- Explicit user action required to collect content.
- History access limited to extension controls.

## How To Run

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select either:
   - `vulnerable/` (for attack demonstration), or
   - `secure/` (for defended behavior).

Use one at a time to avoid confusion while testing.

## Demo Ideas

### Demonstrate Attack 1 (Vulnerable)
1. Load `vulnerable/`.
2. Create a few summaries from pages.
3. On a test malicious page, run:
   ```js
   window.postMessage({ source: "malicious-site", type: "GET_HISTORY" }, "*");
   ```
4. Observe how the extension can return stored summaries to the page context.

### Demonstrate Attack 2 (Vulnerable)
1. Visit a page containing sensitive values (test data only).
2. Generate summary with the vulnerable extension.
3. Inspect stored history and show over-collected content.

### Demonstrate Defenses (Secure)
1. Load `secure/`.
2. Attempt the same `postMessage` exfiltration flow and observe failure.
3. Try summarization without selecting text and observe rejection.
4. Select only safe text and summarize successfully.

## Notes

- This framework is for educational use in a cybersecurity course.
- Do not deploy intentionally vulnerable code in production.
