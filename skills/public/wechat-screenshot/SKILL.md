---
name: wechat-screenshot
description: Capture computer screen and send screenshots via WeChat. Use when user requests to take a screenshot, capture the screen, or send a screen image through WeChat messaging.
---

# WeChat Screenshot

Capture the computer screen and send it via WeChat.

## Quick Start

To capture and send a screenshot:

1. Use the `screenshot.py` script to capture the screen
2. Send the image via the `message` tool with `action=send`

## Example Workflow

```python
# 1. Take screenshot
result = exec("python scripts/screenshot.py -o screenshot.png")

# 2. Send via WeChat
message(
    action="send",
    channel="wechat",
    target="<user-or-group-id>",
    filePath="screenshot.png",
    message="Here's your screenshot"
)
```

## Script Reference

### screenshot.py

Captures the entire screen.

**Usage:**

```bash
python screenshot.py [-o OUTPUT] [-b]
```

**Options:**

- `-o, --output PATH`: Save screenshot to specified path
- `-b, --base64`: Return base64 encoded image data

**Examples:**

```bash
# Save to file
python screenshot.py -o screen.png

# Get base64 data
python screenshot.py -b
```

## Requirements

The script requires:

- Python 3
- Pillow (PIL) library

Install with: `pip install Pillow`
