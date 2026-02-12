# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller 打包配置
生成单个 exe 文件，包含 GUI 前端和微信桥接核心
"""

import sys
from pathlib import Path

block_cipher = None

# 项目根目录
ROOT = Path(SPECPATH)
WXAUTO_PATH = ROOT.parent / 'my-docs' / 'wxauto-main' / 'wxauto'

a = Analysis(
    ['bridge_app.py'],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        ('assets', 'assets'),                  # 前端资源（HTML/CSS/JS）
        (str(WXAUTO_PATH), 'wxauto'),          # wxauto 库
    ],
    hiddenimports=[
        # --- 本地模块 ---
        'config_manager',
        'wechat_handler',
        'bridge',
        'media_server',
        'health_check',
        # --- GUI ---
        'webview',
        # --- WebSocket ---
        'websockets',
        'websockets.client',
        'websockets.server',
        'websocket',
        # --- Windows API ---
        'win32api',
        'win32con',
        'win32gui',
        'win32clipboard',
        'win32ui',
        'win32com',
        'win32com.client',
        'win32process',
        'pythoncom',
        'pywintypes',
        # --- COM / UI 自动化 ---
        'comtypes',
        'comtypes.client',
        'comtypes.stream',
        'uiautomation',
        # --- PIL ---
        'PIL',
        'PIL.Image',
        'PIL.ImageGrab',
        'PIL.ImageDraw',
        'PIL.ImageFont',
        # --- aiohttp (多媒体 HTTP 服务器) ---
        'aiohttp',
        'aiohttp.web',
        'aiohttp.web_app',
        'aiohttp.web_request',
        'aiohttp.web_response',
        'aiohttp.web_fileresponse',
        'aiohttp.web_middlewares',
        'aiohttp.web_runner',
        'multidict',
        'yarl',
        'frozenlist',
        'aiosignal',
        # --- tkinter (wxauto uiplug.py 绘图) ---
        'tkinter',
        '_tkinter',
        # --- wxauto 依赖 ---
        'tenacity',
        'colorama',
        'requests',
        'psutil',
        'pyperclip',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='wxauto-bridge',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # GUI 模式，不显示控制台
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # 可以添加图标: icon='icon.ico'
)
