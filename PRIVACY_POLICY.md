# Privacy Policy for DOM Pointer MCP Chrome Extension

**Last Updated:** 2026-06-04

## Overview

DOM Pointer MCP is a developer tool Chrome extension that allows users to select DOM elements in the browser and send their metadata to a locally running MCP server for AI-assisted development. This extension is designed with privacy in mind — all data stays on your local machine.

## Data Collection

**DOM Pointer MCP does not collect, transmit, or store any personal data to external servers.**

Specifically, this extension:

- Does **not** collect personal information
- Does **not** use analytics or tracking
- Does **not** send data to any remote server
- Does **not** use cookies
- Does **not** collect browsing history
- Does **not** collect authentication credentials or form data

## Data Handling

When you select a DOM element using the extension (via Option/Alt+Click), the following information about that element is extracted locally:

- HTML tag name, id, class names, and attributes
- Text content of the selected element
- CSS styles (at the level you choose)
- Position and dimensions
- Framework component information (React/Vue component name and source file, if available)

This data is sent **exclusively to a locally running MCP server on your own machine** (default: `localhost:7007`) via WebSocket. The data never leaves your local network.

## Local Storage

The extension uses Chrome's `storage` API solely to persist your configuration preferences:

- Whether the extension is enabled or disabled
- The trigger key setting (Option/Alt/Ctrl/Command)
- The local WebSocket port number
- The UI language preference (Chinese/English)
- Whether to clear selection after sending

No user data, browsing data, or DOM element data is stored persistently.

## Permissions

- **`activeTab`**: Used to inject the content script that enables DOM element selection on the current page.
- **`storage`**: Used to save your extension configuration preferences locally.
- **Host permission (`<all_urls>`)**: Required for the content script to function on any webpage you choose to use the extension on. The content script only activates when you interact with the extension.

## Third-Party Services

This extension does not integrate with or send data to any third-party services.

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue at: https://github.com/ymxfl/dom-pointer-mcp/issues

## Open Source

DOM Pointer MCP is open source under the MIT License. You can review the full source code at: https://github.com/ymxfl/dom-pointer-mcp
