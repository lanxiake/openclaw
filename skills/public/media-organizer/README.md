# Media Organizer Skill

A comprehensive skill for organizing photos and videos by date with a beautiful web-based gallery viewer.

## Features

- **Automatic Organization**: Scans drives for photos and videos, organizes by year/month based on file modification time
- **Smart Handling**: Skips duplicates, handles name conflicts with timestamps
- **Web Gallery**: Beautiful responsive interface with filtering, search, and lightbox viewing
- **Local Server**: Built-in HTTP server for browsing the gallery
- **Supported Formats**:
  - Photos: jpg, jpeg, png, gif, bmp, webp, heic
  - Videos: mp4, avi, mov, mkv, wmv, flv, m4v, 3gp

## Installation

This skill is ready to use. No additional dependencies required except PowerShell (included in Windows).

## Usage

### Quick Start

1. **Organize media files**:

   ```powershell
   powershell -ExecutionPolicy Bypass -File "scripts/organize_media.ps1" -SourcePath "E:\" -TargetBase "E:\Photos-Videos"
   ```

2. **Generate media list**:

   ```powershell
   powershell -ExecutionPolicy Bypass -File "scripts/generate_media_list.ps1" -BasePath "E:\Photos-Videos"
   ```

3. **Copy gallery template**:

   ```powershell
   Copy-Item "assets/index.html" -Destination "E:\Photos-Videos\index.html"
   ```

4. **Start web server** (optional):

   ```powershell
   powershell -ExecutionPolicy Bypass -File "scripts/start_server.ps1" -Port 8080 -Path "E:\Photos-Videos"
   ```

5. **Open gallery**: Navigate to `http://localhost:8080` or open `E:\Photos-Videos\index.html` directly in a browser

### Directory Structure

After organizing, files are structured as:

```
E:\Photos-Videos\
├── index.html          # Gallery viewer
├── media_list.json     # Media index
├── stats.json          # Statistics
├── Photos\
│   ├── 2024\
│   │   ├── 2024-01\
│   │   └── 2024-02\
│   └── 2025\
└── Videos\
    ├── 2024\
    └── 2025\
```

## Testing

Run the test suite to verify the skill:

```powershell
powershell -ExecutionPolicy Bypass -File "test_skill.ps1"
```

The test suite will:

- Verify skill structure
- Create test media files
- Run organization scripts
- Generate gallery
- Validate all outputs

## Scripts

### organize_media.ps1

Scans source path for media files and organizes them by date.

**Parameters:**

- `-SourcePath`: Source drive/folder to scan (default: E:\)
- `-TargetBase`: Destination folder for organized files (default: E:\Photos-Videos)

### generate_media_list.ps1

Generates media_list.json for the web gallery.

**Parameters:**

- `-BasePath`: Root path of organized media (default: E:\Photos-Videos)

### start_server.ps1

Starts a local HTTP server for browsing the gallery.

**Parameters:**

- `-Port`: Server port (default: 8080)
- `-Path`: Gallery root path (default: E:\Photos-Videos)

## Customization

### Change File Formats

Edit the `$photoExts` and `$videoExts` arrays in `organize_media.ps1`:

```powershell
$photoExts = @('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.raw')
$videoExts = @('.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.m4v', '.3gp', '.webm')
```

### Modify Gallery Appearance

Edit `assets/index.html` to customize colors, layout, or functionality.

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

## Notes

- **File Safety**: Scripts use Copy-Item, not Move-Item. Original files remain untouched.
- **Disk Space**: Ensure sufficient space in target directory for file copies.
- **Performance**: First scan may take 10-30 minutes for large drives.
- **Incremental**: Re-running organize_media.ps1 only copies new files.

## Test Results

✅ All 12 tests passed:

1. Skill structure validation
2. Required scripts exist
3. Required assets exist
4. Create test media files
5. Run organize_media.ps1
6. Verify organized directory structure
7. Copy gallery template
8. Run generate_media_list.ps1
9. Verify media_list.json generated
10. Verify HTML template
11. Test duplicate file handling
12. Verify stats.json generated

## License

This skill is part of the OpenClaw project.
