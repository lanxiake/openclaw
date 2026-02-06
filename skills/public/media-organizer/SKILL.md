---
name: media-organizer
description: Organize photos and videos by date with a web-based gallery viewer. Use when the user wants to organize, sort, or browse their media files (photos/videos), create a media gallery, or set up a photo/video management system. Supports automatic time-based classification and provides a beautiful web interface for browsing.
---

# Media Organizer

Organize photos and videos from any drive into a time-based directory structure and provide a web-based gallery for browsing.

## Features

- **Auto-organize**: Scan drives for photos and videos, organize by year/month based on file modification time
- **Smart handling**: Skip duplicates, handle name conflicts with timestamps
- **Web gallery**: Beautiful responsive interface with filtering, search, and lightbox viewing
- **Local server**: Built-in HTTP server for browsing the gallery
- **Supported formats**:
  - Photos: jpg, jpeg, png, gif, bmp, webp, heic
  - Videos: mp4, avi, mov, mkv, wmv, flv, m4v, 3gp

## Quick Start

### 1. Organize Media Files

Run the organize script to scan and organize media files:

```powershell
powershell -ExecutionPolicy Bypass -File "scripts/organize_media.ps1" -SourcePath "E:\" -TargetPath "E:\照片和视频"
```

Parameters:
- `-SourcePath`: Drive or folder to scan (default: E:\)
- `-TargetPath`: Output directory (default: E:\照片和视频)

### 2. Generate Media List

After organizing, generate the JSON index for the web gallery:

```powershell
powershell -ExecutionPolicy Bypass -File "scripts/generate_media_list.ps1" -BasePath "E:\照片和视频"
```

### 3. Start Web Server

Launch the local server to browse the gallery:

```powershell
powershell -ExecutionPolicy Bypass -File "scripts/start_server.ps1" -Port 8080 -Path "E:\照片和视频"
```

Then open http://localhost:8080 in a browser.

## Directory Structure

After organizing, files are structured as:

```
E:\照片和视频\
├── index.html          # Gallery viewer
├── media_list.json     # Media index
├── stats.json          # Statistics
├── 照片\
│   ├── 2024\
│   │   ├── 2024-01\
│   │   │   ├── IMG_001.jpg
│   │   │   └── IMG_002.jpg
│   │   └── 2024-02\
│   └── 2025\
└── 视频\
    ├── 2024\
    │   └── 2024-01\
    │       ├── VID_001.mp4
    │       └── VID_002.mp4
    └── 2025\
```

## Scripts

### organize_media.ps1

Scans source path for media files and organizes them by date.

**Parameters:**
- `-SourcePath`: Source drive/folder to scan
- `-TargetPath`: Destination folder for organized files

**Features:**
- Copies files (originals remain untouched)
- Skips duplicates based on file size
- Adds timestamps to conflicting filenames
- Generates stats.json with file counts

### generate_media_list.ps1

Generates media_list.json for the web gallery.

**Parameters:**
- `-BasePath`: Root path of organized media (default: E:\照片和视频)

**Output:**
- Creates media_list.json with file metadata (name, path, type, date, size)

### start_server.ps1

Starts a local HTTP server for browsing the gallery.

**Parameters:**
- `-Port`: Server port (default: 8080)
- `-Path`: Gallery root path (default: E:\照片和视频)

**Requirements:**
- Python 3.x or Node.js installed

## Web Gallery Features

The included index.html provides:

- **Filtering**: By type (all/photos/videos), year, month
- **Search**: Filter by filename
- **Lightbox**: Click to view full-size images or play videos
- **Keyboard navigation**: Arrow keys to navigate, ESC to close
- **Statistics**: Real-time file counts
- **Responsive design**: Works on desktop, tablet, and mobile

## Workflow Integration

### One-time Setup

```powershell
# Copy gallery template to target
Copy-Item "assets/index.html" -Destination "E:\照片和视频\index.html"

# Organize all media
powershell -ExecutionPolicy Bypass -File "scripts/organize_media.ps1"

# Generate index
powershell -ExecutionPolicy Bypass -File "scripts/generate_media_list.ps1"

# Start server
powershell -ExecutionPolicy Bypass -File "scripts/start_server.ps1"
```

### Incremental Updates

When new media files are added:

```powershell
# Re-organize (only copies new files)
powershell -ExecutionPolicy Bypass -File "scripts/organize_media.ps1"

# Update index
powershell -ExecutionPolicy Bypass -File "scripts/generate_media_list.ps1"

# Refresh browser
```

## Customization

### Change Target Directory

Edit the `-TargetPath` parameter when running scripts, or modify the default in the scripts.

### Add File Formats

Edit the `$photoExts` and `$videoExts` arrays in organize_media.ps1:

```powershell
$photoExts = @('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.raw')
$videoExts = @('.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.m4v', '.3gp', '.webm')
```

### Modify Gallery Appearance

Edit assets/index.html to customize colors, layout, or functionality.

## Troubleshooting

### Script Execution Policy Error

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Server Won't Start

- Ensure Python or Node.js is installed
- Check if port 8080 is available
- Try a different port: `-Port 8081`

### Gallery Shows No Files

- Verify media_list.json exists in the gallery root
- Check file paths in media_list.json are correct
- Refresh browser cache (Ctrl+F5)

### Slow Scanning

- Exclude unnecessary directories by modifying the Get-ChildItem filter
- Use SSD drives for better performance
- Temporarily disable antivirus scanning

## Notes

- **File Safety**: Scripts use Copy-Item, not Move-Item. Original files remain untouched.
- **Disk Space**: Ensure sufficient space in target directory for file copies.
- **Performance**: First scan may take 10-30 minutes for large drives.
- **Incremental**: Re-running organize_media.ps1 only copies new files.
