# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['D:\\AI-workspace\\openclaw\\wxauto-bridge\\bridge.py'],
    pathex=[],
    binaries=[],
    datas=[('D:\\AI-workspace\\openclaw\\my-docs\\wxauto-main\\wxauto', 'wxauto')],
    hiddenimports=['websockets', 'websockets.client', 'websockets.server', 'win32api', 'win32con', 'win32gui', 'win32clipboard', 'win32ui', 'win32com', 'win32com.client', 'pythoncom', 'pywintypes', 'comtypes', 'comtypes.client', 'uiautomation', 'PIL', 'PIL.Image', 'PIL.ImageGrab', 'PIL.ImageDraw', 'PIL.ImageFont', 'aiohttp', 'aiohttp.web', 'aiohttp.web_app', 'aiohttp.web_request', 'aiohttp.web_response', 'aiohttp.web_fileresponse', 'aiohttp.web_middlewares', 'aiohttp.web_runner', 'aiofiles', 'multidict', 'yarl', 'frozenlist', 'aiosignal', 'tkinter', '_tkinter', 'tenacity', 'colorama', 'requests', 'comtypes.stream', 'win32process', 'psutil', 'pyperclip'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='wechat-bridge',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
