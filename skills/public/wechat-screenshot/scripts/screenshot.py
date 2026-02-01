#!/usr/bin/env python3
"""
Screenshot utility for capturing screen content.
Saves screenshot to specified path or returns base64 encoded data.
"""

import sys
import argparse
from PIL import ImageGrab
import base64
from io import BytesIO


def take_screenshot(output_path=None, return_base64=False):
    """
    Take a screenshot of the entire screen.
    
    Args:
        output_path: Path to save the screenshot (optional)
        return_base64: If True, return base64 encoded image data
    
    Returns:
        Path to saved file or base64 string if return_base64=True
    """
    # Capture the screen
    screenshot = ImageGrab.grab()
    
    if return_base64:
        # Convert to base64
        buffered = BytesIO()
        screenshot.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return img_str
    
    if output_path:
        # Save to file
        screenshot.save(output_path, "PNG")
        return output_path
    
    # Default: save to temp file
    import tempfile
    import os
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    temp_path = temp_file.name
    temp_file.close()
    screenshot.save(temp_path, "PNG")
    return temp_path


def main():
    parser = argparse.ArgumentParser(description='Take a screenshot')
    parser.add_argument('-o', '--output', help='Output file path')
    parser.add_argument('-b', '--base64', action='store_true', 
                       help='Return base64 encoded image')
    
    args = parser.parse_args()
    
    result = take_screenshot(
        output_path=args.output,
        return_base64=args.base64
    )
    
    print(result)


if __name__ == '__main__':
    main()
