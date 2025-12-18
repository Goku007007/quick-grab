# Quick Grab - Job Details Extension

A Chrome extension that extracts and copies job details (company name, role, and description) from job posting sites to your clipboard with a single click.

## Tech Stack

- **Manifest V3** Chrome Extension
- **JavaScript** (Vanilla)
- **Chrome APIs**: scripting, activeTab, clipboardWrite

## Supported Platforms

- LinkedIn (2024/2025 UI)
- Indeed
- Glassdoor
- Lever
- Greenhouse
- Generic job sites (fallback support)

## Installation

1. Clone this repository
   ```bash
   git clone https://github.com/gokul-nandakumar/quick-grab.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right)

4. Click **Load unpacked** and select the project folder

## Usage

1. Navigate to any job posting on a supported site
2. Click the Quick Grab extension icon in the toolbar
3. Job details are copied to your clipboard in the following format:

```
Company: [Company Name]

Role: [Job Title]

Job Description:
[Full description text]
```

## Permissions

| Permission | Purpose |
|------------|---------|
| activeTab | Access current job posting page |
| scripting | Inject content scripts for extraction |
| clipboardWrite | Copy job details to clipboard |

This extension does not collect, store, or transmit any user data.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

Gokul Nandakumar
