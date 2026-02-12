#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
微信桥接器打包脚本
将 bridge.py 打包成独立的 Windows 可执行文件
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

# 设置控制台编码
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 国内 pip 镜像源列表
PIP_MIRRORS = [
    ("清华大学", "https://pypi.tuna.tsinghua.edu.cn/simple"),
    ("阿里云", "https://mirrors.aliyun.com/pypi/simple"),
    ("中科大", "https://pypi.mirrors.ustc.edu.cn/simple"),
    ("豆瓣", "https://pypi.douban.com/simple"),
]

# 默认使用清华镜像
DEFAULT_MIRROR = PIP_MIRRORS[0][1]


def pip_install(package: str, mirror: str = DEFAULT_MIRROR) -> bool:
    """
    使用指定镜像源安装 pip 包

    Args:
        package: 要安装的包名
        mirror: pip 镜像源 URL

    Returns:
        bool: 安装是否成功
    """
    print(f"正在安装 {package}...")
    print(f"   使用镜像: {mirror}")
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install",
             "-i", mirror,
             "--trusted-host", mirror.split("//")[1].split("/")[0],
             package],
            check=True
        )
        print(f"[OK] {package} 安装成功")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] {package} 安装失败: {e}")
        return False


def check_pyinstaller():
    """检查 PyInstaller 是否安装"""
    try:
        import PyInstaller
        print(f"[OK] PyInstaller 已安装: {PyInstaller.__version__}")
        return True
    except ImportError:
        print("[ERROR] PyInstaller 未安装")
        return False


def install_pyinstaller():
    """安装 PyInstaller（使用国内镜像）"""
    return pip_install("pyinstaller")

def build_exe():
    """构建可执行文件"""
    # 获取当前目录
    script_dir = Path(__file__).parent
    bridge_script = script_dir / "bridge.py"
    wxauto_path = script_dir.parent / "my-docs" / "wxauto-main" / "wxauto"

    # 检查文件是否存在
    if not bridge_script.exists():
        print(f"[ERROR] 找不到 bridge.py: {bridge_script}")
        return False

    print(f"[BUILD] 开始打包...")
    print(f"   源文件: {bridge_script}")
    print(f"   wxauto 路径: {wxauto_path}")

    # 构建 PyInstaller 命令
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", "wechat-bridge",
        "--onefile",  # 打包成单个文件
        "--console",  # 控制台应用
        "--noconfirm",  # 覆盖已有文件
        "--clean",  # 清理临时文件
        # 添加 wxauto 模块
        "--add-data", f"{wxauto_path};wxauto",
        # 隐藏导入 - websockets
        "--hidden-import", "websockets",
        "--hidden-import", "websockets.client",
        "--hidden-import", "websockets.server",
        # 隐藏导入 - win32
        "--hidden-import", "win32api",
        "--hidden-import", "win32con",
        "--hidden-import", "win32gui",
        "--hidden-import", "win32clipboard",
        "--hidden-import", "win32ui",
        "--hidden-import", "win32com",
        "--hidden-import", "win32com.client",
        "--hidden-import", "pythoncom",
        "--hidden-import", "pywintypes",
        # 隐藏导入 - comtypes
        "--hidden-import", "comtypes",
        "--hidden-import", "comtypes.client",
        # 隐藏导入 - uiautomation
        "--hidden-import", "uiautomation",
        # 隐藏导入 - PIL
        "--hidden-import", "PIL",
        "--hidden-import", "PIL.Image",
        "--hidden-import", "PIL.ImageGrab",
        "--hidden-import", "PIL.ImageDraw",
        "--hidden-import", "PIL.ImageFont",
        # 隐藏导入 - aiohttp (多媒体服务器)
        "--hidden-import", "aiohttp",
        "--hidden-import", "aiohttp.web",
        "--hidden-import", "aiohttp.web_app",
        "--hidden-import", "aiohttp.web_request",
        "--hidden-import", "aiohttp.web_response",
        "--hidden-import", "aiohttp.web_fileresponse",
        "--hidden-import", "aiohttp.web_middlewares",
        "--hidden-import", "aiohttp.web_runner",
        "--hidden-import", "aiofiles",
        "--hidden-import", "multidict",
        "--hidden-import", "yarl",
        "--hidden-import", "frozenlist",
        "--hidden-import", "aiosignal",
        # 隐藏导入 - tkinter (wxauto uiplug.py 需要)
        "--hidden-import", "tkinter",
        "--hidden-import", "_tkinter",
        # 隐藏导入 - wxauto 其他依赖
        "--hidden-import", "tenacity",
        "--hidden-import", "colorama",
        "--hidden-import", "requests",
        "--hidden-import", "comtypes.stream",
        "--hidden-import", "win32process",
        # 隐藏导入 - 其他
        "--hidden-import", "psutil",
        "--hidden-import", "pyperclip",
        # 图标（如果有）
        # "--icon", "icon.ico",
        str(bridge_script)
    ]

    print(f"\n执行命令: {' '.join(cmd)}")

    try:
        # 切换到脚本目录
        os.chdir(script_dir)

        # 执行打包
        result = subprocess.run(cmd, check=True)

        # 检查输出文件
        dist_dir = script_dir / "dist"
        exe_file = dist_dir / "wechat-bridge.exe"

        if exe_file.exists():
            file_size = exe_file.stat().st_size / (1024 * 1024)  # MB
            print(f"\n[OK] 打包成功!")
            print(f"   输出文件: {exe_file}")
            print(f"   文件大小: {file_size:.2f} MB")
            return True
        else:
            print(f"[ERROR] 打包失败: 输出文件不存在")
            return False

    except subprocess.CalledProcessError as e:
        print(f"[ERROR] 打包失败: {e}")
        return False

def create_spec_file():
    """创建 PyInstaller spec 文件（高级配置）"""
    script_dir = Path(__file__).parent
    wxauto_path = script_dir.parent / "my-docs" / "wxauto-main" / "wxauto"

    spec_content = f'''# -*- mode: python ; coding: utf-8 -*-
# 微信桥接器 PyInstaller 配置文件

block_cipher = None

# 数据文件
datas = [
    (r'{wxauto_path}', 'wxauto'),
]

# 隐藏导入
hiddenimports = [
    'websockets',
    'websockets.client',
    'websockets.server',
    'win32api',
    'win32con',
    'win32gui',
    'win32clipboard',
    'comtypes',
    'comtypes.client',
    'uiautomation',
    'PIL',
    'PIL.Image',
    'PIL.ImageGrab',
    'PIL.ImageDraw',
    'PIL.ImageFont',
    'psutil',
    'pyperclip',
    # tkinter (wxauto uiplug.py 需要)
    'tkinter',
    '_tkinter',
    # wxauto 其他依赖
    'tenacity',
    'colorama',
    'requests',
    'comtypes.stream',
    'win32process',
    # aiohttp 多媒体服务器
    'aiohttp',
    'aiohttp.web',
    'aiohttp.web_app',
    'aiohttp.web_request',
    'aiohttp.web_response',
    'aiohttp.web_fileresponse',
    'aiohttp.web_middlewares',
    'aiohttp.web_runner',
    'aiofiles',
    'multidict',
    'yarl',
    'frozenlist',
    'aiosignal',
]

a = Analysis(
    ['bridge.py'],
    pathex=[r'{script_dir}'],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={{}},
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
'''

    spec_file = script_dir / "wechat-bridge.spec"
    with open(spec_file, 'w', encoding='utf-8') as f:
        f.write(spec_content)

    print(f"[OK] spec 文件已创建: {spec_file}")
    return spec_file

def main():
    print("=== 微信桥接器打包工具 ===")
    print()

    # 1. 检查 PyInstaller
    if not check_pyinstaller():
        if not install_pyinstaller():
            print("\n请手动安装 PyInstaller: pip install pyinstaller")
            sys.exit(1)

    # 2. 创建 spec 文件
    print("\n创建 spec 配置文件...")
    spec_file = create_spec_file()

    # 3. 构建 exe
    print("\n开始构建可执行文件...")
    if build_exe():
        print("\n" + "="*50)
        print("[OK] 打包完成!")
        print("="*50)
        print("\n使用方法:")
        print("  wechat-bridge.exe --gateway ws://127.0.0.1:19001 --token <your-token> -v")
        print("\n注意事项:")
        print("  1. 确保微信客户端已登录")
        print("  2. 确保 Gateway 正在运行")
        print("  3. 使用正确的 auth token")
    else:
        print("\n[ERROR] 打包失败，请检查错误信息")
        sys.exit(1)

if __name__ == "__main__":
    main()
