---
name: printer
description: Print documents, images, and text using Windows printers. Use when user wants to print files received via WeChat or other channels. Supports creating formatted HTML documents from images/text before printing, single-sided printing.
---

# Printer Skill

Print documents, images, and text to Windows printers with support for formatting and layout.

## Available Printers

Check available printers:

```powershell
Get-Printer | Select-Object Name, PrinterStatus
```

Current system has:

- **Epson L4260 Series** (EPSONBE72A5) - Main printer
- Microsoft Print to PDF
- Fax

## Workflow

### 1. Direct Printing (Simple Files)

For images, PDFs, or existing documents:

```powershell
powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\print_document.ps1" -FilePath "path\to\file" -Printer "PrinterName"
```

Examples:

```powershell
# Print to Epson printer
powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\print_document.ps1" -FilePath "document.pdf" -Printer "EPSONBE72A5 (L4260 Series)"

# Print image
powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\print_document.ps1" -FilePath "photo.jpg" -Printer "EPSONBE72A5 (L4260 Series)"
```

### 2. Create Formatted Document First (Images/Text from WeChat)

When user sends images or text via WeChat that need formatting:

**Step 1: Create HTML document**

```powershell
powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\create_print_html.ps1" -Output "D:\AI-workspace\workspace\print.html" -Title "Document Title" -Images "path\to\image1.jpg","path\to\image2.jpg" -Texts "Text content 1","Text content 2"
```

**Step 2: Print the document**

```powershell
powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\print_document.ps1" -FilePath "D:\AI-workspace\workspace\print.html" -Printer "EPSONBE72A5 (L4260 Series)"
```

## Common Scenarios

### Scenario 1: User sends image via WeChat, wants to print

WeChat images are saved to: `D:\AI-workspace\openclaw\wxauto-bridge\media\wxauto_image_*.jpg`

**Option A: Print directly**

```powershell
powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\print_document.ps1" -FilePath "D:\AI-workspace\openclaw\wxauto-bridge\media\wxauto_image_20260211003034776939.jpg" -Printer "EPSONBE72A5 (L4260 Series)"
```

**Option B: Add to formatted document first (if need title or multiple images)**

```powershell
powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\create_print_html.ps1" -Output "D:\AI-workspace\workspace\photo.html" -Title "Photo" -Images "D:\AI-workspace\openclaw\wxauto-bridge\media\wxauto_image_20260211003034776939.jpg"

powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\print_document.ps1" -FilePath "D:\AI-workspace\workspace\photo.html" -Printer "EPSONBE72A5 (L4260 Series)"
```

### Scenario 2: User sends multiple images, wants them in one document

```powershell
# Create document with all images
powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\create_print_html.ps1" -Output "D:\AI-workspace\workspace\photos.html" -Title "Photos" -Images "image1.jpg","image2.jpg","image3.jpg"

# Print
powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\print_document.ps1" -FilePath "D:\AI-workspace\workspace\photos.html" -Printer "EPSONBE72A5 (L4260 Series)"
```

### Scenario 3: User sends text, wants to print

```powershell
# Create document
powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\create_print_html.ps1" -Output "D:\AI-workspace\workspace\text.html" -Title "Notes" -Texts "First paragraph","Second paragraph"

# Print
powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\print_document.ps1" -FilePath "D:\AI-workspace\workspace\text.html" -Printer "EPSONBE72A5 (L4260 Series)"
```

### Scenario 4: Mixed content (images + text)

```powershell
powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\create_print_html.ps1" -Output "D:\AI-workspace\workspace\mixed.html" -Title "My Document" -Images "photo1.jpg","photo2.jpg" -Texts "Description of photos","Additional notes"

powershell -ExecutionPolicy Bypass -File "D:\AI-workspace\openclaw\skills\public\printer\scripts\print_document.ps1" -FilePath "D:\AI-workspace\workspace\mixed.html" -Printer "EPSONBE72A5 (L4260 Series)"
```

## Important Notes

- **WeChat images location**: `D:\AI-workspace\openclaw\wxauto-bridge\media\`
- **Output directory**: `D:\AI-workspace\workspace\` (recommended for generated documents)
- **HTML format**: Uses HTML with embedded base64 images (no external dependencies)
- **Image scaling**: Images automatically scaled to fit page (max 800px width)
- **Chinese support**: Full UTF-8 support for Chinese titles and text
- **Print method**: Uses Windows built-in print handler (rundll32)

## Features

✅ **Tested and Working:**

- Direct print images (JPG, PNG)
- Direct print PDFs and documents
- Create HTML documents with images
- Create HTML documents with text
- Create mixed content documents (images + text)
- Specify printer
- Chinese text support

## Troubleshooting

If printer shows as "Offline":

```powershell
# Check printer status
Get-Printer

# Ensure printer is powered on and connected
# Check printer queue in Windows Settings
```

If print fails:

- Verify printer is online and has paper
- Check printer queue for errors
- Try printing to "Microsoft Print to PDF" for testing
