"""
微信发送和消息监听功能测试脚本
测试对象：文件传输助手
微信路径：C:\\Mysoft\\Weixin\\Weixin.exe
"""

import sys
import os
import time
from pathlib import Path

# 添加 wxauto 模块到路径
sys.path.insert(0, str(Path(__file__).parent))

from wxauto import WeChat
from wxauto.msgs import FriendMessage


def test_basic_connection():
    """测试1: 基本连接测试"""
    print("=" * 60)
    print("测试1: 基本连接测试")
    print("=" * 60)
    
    try:
        # 初始化微信实例（会自动连接到已打开的微信）
        wx = WeChat()
        print("✓ 成功连接到微信客户端")
        
        # 检查是否在线
        if wx.IsOnline():
            print("✓ 微信在线状态正常")
        else:
            print("✗ 微信不在线")
            return None
            
        # 获取当前用户信息
        try:
            my_info = wx.GetMyInfo()
            print(f"✓ 当前用户: {my_info.get('nickname', '未知')}")
        except Exception as e:
            print(f"⚠ 无法获取用户信息: {e}")
        
        return wx
        
    except Exception as e:
        print(f"✗ 连接失败: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_send_message(wx):
    """测试2: 发送消息测试"""
    print("\n" + "=" * 60)
    print("测试2: 发送消息测试（发送到文件传输助手）")
    print("=" * 60)
    
    try:
        # 发送测试消息到文件传输助手
        test_message = f"测试消息 - {time.strftime('%Y-%m-%d %H:%M:%S')}"
        
        print(f"正在发送消息: {test_message}")
        result = wx.SendMsg(test_message, who="文件传输助手")
        
        if result:
            print(f"✓ 消息发送成功")
        else:
            print(f"✗ 消息发送失败")
            
        # 等待一下，让消息显示
        time.sleep(1)
        
        # 尝试获取消息历史
        print("\n尝试获取聊天记录...")
        wx.ChatWith("文件传输助手")
        time.sleep(1)
        
        msgs = wx.GetAllMessage()
        if msgs:
            print(f"✓ 成功获取 {len(msgs)} 条消息")
            # 显示最后5条消息
            print("\n最近的消息:")
            for msg in msgs[-5:]:
                print(f"  [{msg.type}] {msg.sender}: {msg.content[:50] if msg.content else '(无内容)'}")
        else:
            print("⚠ 未获取到消息")
            
        return True
        
    except Exception as e:
        print(f"✗ 发送消息失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_message_listener(wx):
    """测试3: 消息监听测试"""
    print("\n" + "=" * 60)
    print("测试3: 消息监听测试（监听文件传输助手）")
    print("=" * 60)
    
    message_count = 0
    
    def on_message(msg, chat):
        """消息回调函数"""
        nonlocal message_count
        message_count += 1
        
        print(f"\n收到新消息 #{message_count}:")
        print(f"  发送者: {msg.sender}")
        print(f"  类型: {msg.type}")
        print(f"  内容: {msg.content[:100] if msg.content else '(无文本内容)'}")
        
        # 自动回复
        try:
            if isinstance(msg, FriendMessage) and msg.content:
                reply_text = f"已收到你的消息: {msg.content[:20]}..."
                print(f"  正在回复: {reply_text}")
                msg.reply(reply_text)
        except Exception as e:
            print(f"  回复失败: {e}")
    
    try:
        # 添加监听
        print("正在添加消息监听...")
        wx.AddListenChat(nickname="文件传输助手", callback=on_message)
        print("✓ 消息监听已启动")
        
        print("\n" + "-" * 60)
        print("监听程序运行中...")
        print("请在微信中向【文件传输助手】发送消息进行测试")
        print("监听时长: 30秒")
        print("按 Ctrl+C 可提前结束")
        print("-" * 60)
        
        # 运行30秒
        start_time = time.time()
        try:
            while time.time() - start_time < 30:
                time.sleep(1)
                elapsed = int(time.time() - start_time)
                remaining = 30 - elapsed
                print(f"\r已运行 {elapsed}秒, 剩余 {remaining}秒...", end="", flush=True)
        except KeyboardInterrupt:
            print("\n\n用户中断")
        
        print(f"\n\n监听结束，共收到 {message_count} 条新消息")
        
        # 移除监听
        print("正在移除监听...")
        wx.RemoveListenChat(nickname="文件传输助手")
        print("✓ 监听已移除")
        
        return True
        
    except Exception as e:
        print(f"✗ 监听测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """主测试流程"""
    print("\n" + "=" * 60)
    print("wxauto 微信自动化测试")
    print("=" * 60)
    print(f"微信路径: C:\\Mysoft\\Weixin\\Weixin.exe")
    print(f"测试对象: 文件传输助手")
    print(f"时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # 检查命令行参数
    auto_mode = len(sys.argv) > 1 and sys.argv[1] == '--auto'
    
    if not auto_mode:
        # 提示用户
        print("\n⚠ 请确保:")
        print("  1. 微信已经打开并登录")
        print("  2. 可以访问【文件传输助手】")
        print("\n按 Enter 继续，按 Ctrl+C 取消...")
        try:
            input()
        except KeyboardInterrupt:
            print("\n测试取消")
            return
    else:
        print("\n自动模式：跳过用户确认")
    
    # 测试1: 连接
    wx = test_basic_connection()
    if not wx:
        print("\n❌ 测试失败：无法连接到微信")
        return
    
    # 测试2: 发送消息
    if not test_send_message(wx):
        print("\n⚠ 发送消息测试失败，但继续进行监听测试")
    
    # 测试3: 消息监听
    test_message_listener(wx)
    
    # 测试总结
    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
