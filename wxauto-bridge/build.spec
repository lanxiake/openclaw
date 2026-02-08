# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller 打包配置
生成单个 exe 文件
"""

import sys
from pathlib import Path

block_cipher = None

# 项目根目录
ROOT = Path(SPECPATH)

a = Analysis(
    ['bridge_app.py'],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        ('assets', 'assets'),  # 包含前端资源
    ],
    hiddenimports=[
        'webview',
        'websockets',
        'websocket',
        'config_manager',
        'wechat_handler',
        'bridge',
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
    console=False,  # 不显示控制台
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # 可以添加图标: icon='icon.ico'
)
