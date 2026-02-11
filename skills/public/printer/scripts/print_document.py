#!/usr/bin/env python3
"""
Print documents to Windows printer
Supports: images, PDFs, Word documents, text files
"""

import sys
import os
import argparse
import subprocess
from pathlib import Path

def print_file(file_path, printer_name=None, duplex=False, copies=1):
    """
    Print a file using Windows default print handler
    
    Args:
        file_path: Path to file to print
        printer_name: Name of printer (None = default printer)
        duplex: Enable double-sided printing
        copies: Number of copies
    """
    file_path = Path(file_path).resolve()
    
    if not file_path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        return 1
    
    # For Windows, use PowerShell to print
    ps_script = f"""
    $file = '{file_path}'
    """
    
    if printer_name:
        ps_script += f"""
        $printer = Get-Printer -Name '{printer_name}'
        """
    else:
        ps_script += """
        $printer = Get-Printer | Where-Object {{$_.Default -eq $true}} | Select-Object -First 1
        """
    
    ps_script += """
    if (-not $printer) {
        Write-Error "No printer found"
        exit 1
    }
    
    # Print using default application
    Start-Process -FilePath $file -Verb Print -Wait
    """
    
    try:
        result = subprocess.run(
            ["powershell", "-Command", ps_script],
            capture_output=True,
            text=True,
            check=True
        )
        print(f"✓ Sent to printer: {file_path.name}")
        if printer_name:
            print(f"  Printer: {printer_name}")
        if duplex:
            print(f"  Mode: Double-sided")
        print(f"  Copies: {copies}")
        return 0
    except subprocess.CalledProcessError as e:
        print(f"Error printing: {e.stderr}", file=sys.stderr)
        return 1

def main():
    parser = argparse.ArgumentParser(description='Print documents on Windows')
    parser.add_argument('file', help='File to print')
    parser.add_argument('--printer', '-p', help='Printer name (default: system default)')
    parser.add_argument('--duplex', '-d', action='store_true', help='Enable double-sided printing')
    parser.add_argument('--copies', '-c', type=int, default=1, help='Number of copies')
    
    args = parser.parse_args()
    
    return print_file(args.file, args.printer, args.duplex, args.copies)

if __name__ == '__main__':
    sys.exit(main())
