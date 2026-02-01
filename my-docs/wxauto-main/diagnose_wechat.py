"""
微信版本检测和诊断脚本
"""

import subprocess
import sys
import os
from pathlib import Path

def check_wechat_version():
    """检查微信版本"""
    print("=" * 60)
    print("微信版本检测")
    print("=" * 60)
    
    wechat_path = r"C:\Mysoft\Weixin\Weixin.exe"
    
    # 检查微信是否存在
    if not os.path.exists(wechat_path):
        print(f"✗ 未找到微信程序: {wechat_path}")
        return None
    
    print(f"✓ 找到微信程序: {wechat_path}")
    
    # 获取版本信息
    try:
        cmd = f'powershell "(Get-Item \'{wechat_path}\').VersionInfo.FileVersion"'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        version = result.stdout.strip()
        
        if version:
            print(f"✓ 微信版本: {version}")
            
            # 解析版本号
            major_version = version.split('.')[0]
            
            if major_version == '3':
                print(f"✓ 版本兼容: wxauto 支持微信 3.9.x")
                return version
            elif major_version == '4':
                print(f"✗ 版本不兼容: 当前版本 {version} 是 4.x 系列")
                print(f"  wxauto 仅支持微信 3.9.x 版本")
                return version
            else:
                print(f"⚠ 未知版本系列: {major_version}.x")
                return version
        else:
            print("✗ 无法获取版本信息")
            return None
            
    except Exception as e:
        print(f"✗ 检测失败: {e}")
        return None


def check_wechat_process():
    """检查微信进程"""
    print("\n" + "=" * 60)
    print("微信进程检测")
    print("=" * 60)
    
    try:
        # 查找微信进程
        result = subprocess.run(
            'tasklist | findstr -i "WeChat"',
            shell=True,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        processes = result.stdout.strip()
        
        if processes:
            print("✓ 微信进程正在运行:")
            for line in processes.split('\n'):
                if line.strip():
                    print(f"  {line}")
            return True
        else:
            print("✗ 未检测到微信进程")
            return False
            
    except Exception as e:
        print(f"✗ 检测失败: {e}")
        return False


def check_dependencies():
    """检查 Python 依赖"""
    print("\n" + "=" * 60)
    print("依赖检测")
    print("=" * 60)
    
    dependencies = {
        'comtypes': 'COM 接口支持',
        'win32com.client': 'Windows COM 客户端 (pywin32)',
        'psutil': '进程管理工具',
        'pythoncom': 'Python COM 支持 (pywin32)',
    }
    
    all_ok = True
    
    for module, desc in dependencies.items():
        try:
            __import__(module)
            print(f"✓ {module:20s} - {desc}")
        except ImportError:
            print(f"✗ {module:20s} - {desc} (未安装)")
            all_ok = False
    
    return all_ok


def get_wechat_window_info():
    """获取微信窗口信息"""
    print("\n" + "=" * 60)
    print("微信窗口检测")
    print("=" * 60)
    
    try:
        # 添加 wxauto 模块路径
        sys.path.insert(0, str(Path(__file__).parent))
        
        from wxauto.utils import GetAllWindows
        
        # 获取所有微信窗口
        windows = GetAllWindows()
        
        print(f"找到 {len(windows)} 个窗口")
        
        for i, win in enumerate(windows):
            try:
                print(f"\n窗口 {i + 1}:")
                print(f"  句柄: {win.Handle}")
                print(f"  类名: {win.ClassName}")
                print(f"  名称: {win.Name}")
                print(f"  可见: {win.Visible}")
            except Exception as e:
                print(f"  (无法获取信息: {e})")
        
        return len(windows) > 0
        
    except Exception as e:
        print(f"✗ 检测失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("\n" + "=" * 60)
    print("wxauto 微信自动化诊断工具")
    print("=" * 60)
    print(f"时间: {os.popen('date /t').read().strip()} {os.popen('time /t').read().strip()}")
    print("=" * 60)
    
    # 检查1: 微信版本
    version = check_wechat_version()
    
    # 检查2: 微信进程
    process_running = check_wechat_process()
    
    # 检查3: Python 依赖
    deps_ok = check_dependencies()
    
    # 检查4: 微信窗口
    if deps_ok:
        windows_ok = get_wechat_window_info()
    else:
        print("\n跳过窗口检测（需要先安装依赖）")
        windows_ok = False
    
    # 总结
    print("\n" + "=" * 60)
    print("诊断总结")
    print("=" * 60)
    
    issues = []
    
    if not version:
        issues.append("未能检测到微信版本")
    elif version.startswith('4'):
        issues.append(f"微信版本 {version} 不兼容（需要 3.9.x）")
    
    if not process_running:
        issues.append("微信未运行")
    
    if not deps_ok:
        issues.append("Python 依赖未完全安装")
    
    if not windows_ok and deps_ok:
        issues.append("无法检测到微信窗口")
    
    if issues:
        print("\n发现以下问题:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
        
        print("\n建议:")
        if version and version.startswith('4'):
            print("  1. 下载并安装微信 3.9.x 版本")
            print("     下载地址: https://pc.weixin.qq.com/")
            print("     (需要找到旧版本下载链接)")
        
        if not deps_ok:
            print("  2. 安装 Python 依赖:")
            print("     pip install comtypes pywin32 psutil")
        
        if not process_running:
            print("  3. 启动微信并登录")
    else:
        print("✓ 所有检查通过，可以使用 wxauto")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
