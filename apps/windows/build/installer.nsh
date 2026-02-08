; OpenClaw Assistant NSIS Installer Script
; Custom installer configuration for Windows
;
; 功能:
; - 自定义安装/卸载流程
; - 开机自启动选项
; - 系统托盘快速启动
; - 清理用户数据选项

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

; ============================================================================
; 安装前初始化
; ============================================================================

!macro customHeader
  ; 定义自定义变量
  Var StartWithWindows
  Var AddToContextMenu
!macroend

!macro preInit
  ; 设置 64 位注册表视图
  SetRegView 64
!macroend

!macro customInit
  ; 初始化变量默认值
  StrCpy $StartWithWindows "1"
  StrCpy $AddToContextMenu "0"
!macroend

; ============================================================================
; 自定义安装页面
; ============================================================================

!macro customPageAfterSelectDir
  ; 在选择目录后显示额外选项页面
!macroend

; ============================================================================
; 安装完成后的操作
; ============================================================================

!macro customInstall
  ; -----------------------------------------------------------------------
  ; 创建应用数据目录
  ; -----------------------------------------------------------------------
  DetailPrint "正在创建应用数据目录..."
  CreateDirectory "$APPDATA\OpenClaw Assistant"
  CreateDirectory "$APPDATA\OpenClaw Assistant\logs"
  CreateDirectory "$APPDATA\OpenClaw Assistant\config"
  CreateDirectory "$APPDATA\OpenClaw Assistant\data"
  CreateDirectory "$APPDATA\OpenClaw Assistant\cache"

  ; -----------------------------------------------------------------------
  ; 写入注册表信息
  ; -----------------------------------------------------------------------
  DetailPrint "正在写入注册表..."

  ; 应用信息
  WriteRegStr HKCU "Software\OpenClaw\Assistant" "InstallPath" "$INSTDIR"
  WriteRegStr HKCU "Software\OpenClaw\Assistant" "Version" "${VERSION}"
  WriteRegStr HKCU "Software\OpenClaw\Assistant" "DataPath" "$APPDATA\OpenClaw Assistant"

  ; 添加到系统 PATH (可选)
  ; EnVar::AddValue "PATH" "$INSTDIR"

  ; -----------------------------------------------------------------------
  ; 配置开机自启动 (根据用户选择)
  ; -----------------------------------------------------------------------
  ${If} $StartWithWindows == "1"
    DetailPrint "正在配置开机自启动..."
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "OpenClawAssistant" '"$INSTDIR\${PRODUCT_FILENAME}.exe" --hidden'
  ${EndIf}

  ; -----------------------------------------------------------------------
  ; 右键菜单集成 (可选)
  ; -----------------------------------------------------------------------
  ${If} $AddToContextMenu == "1"
    DetailPrint "正在添加右键菜单..."
    ; 添加目录右键菜单
    WriteRegStr HKCR "Directory\Background\shell\OpenClawAssistant" "" "用 OpenClaw 打开"
    WriteRegStr HKCR "Directory\Background\shell\OpenClawAssistant" "Icon" '"$INSTDIR\${PRODUCT_FILENAME}.exe"'
    WriteRegStr HKCR "Directory\Background\shell\OpenClawAssistant\command" "" '"$INSTDIR\${PRODUCT_FILENAME}.exe" --path "%V"'
  ${EndIf}

  ; -----------------------------------------------------------------------
  ; 创建快速启动快捷方式
  ; -----------------------------------------------------------------------
  DetailPrint "正在创建快捷方式..."
  CreateShortCut "$QUICKLAUNCH\OpenClaw Assistant.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe"

  ; -----------------------------------------------------------------------
  ; 写入应用默认配置
  ; -----------------------------------------------------------------------
  DetailPrint "正在写入默认配置..."
  IfFileExists "$APPDATA\OpenClaw Assistant\config\settings.json" ConfigExists
    FileOpen $0 "$APPDATA\OpenClaw Assistant\config\settings.json" w
    FileWrite $0 '{"version": "${VERSION}", "language": "zh-CN", "theme": "system", "autoStart": true}'
    FileClose $0
  ConfigExists:

  DetailPrint "安装完成!"
!macroend

; ============================================================================
; 卸载前的操作
; ============================================================================

!macro customUnInstall
  ; -----------------------------------------------------------------------
  ; 询问是否删除用户数据
  ; -----------------------------------------------------------------------
  MessageBox MB_YESNO|MB_ICONQUESTION "是否删除用户数据和配置文件？$\n$\n此操作将删除以下内容：$\n- 聊天记录$\n- 配置文件$\n- 缓存数据$\n$\n此操作不可恢复！" IDNO SkipRemoveData
    DetailPrint "正在删除用户数据..."
    RMDir /r "$APPDATA\OpenClaw Assistant"
    Goto DataRemoved
  SkipRemoveData:
    DetailPrint "保留用户数据"
  DataRemoved:

  ; -----------------------------------------------------------------------
  ; 删除开机自启动
  ; -----------------------------------------------------------------------
  DetailPrint "正在删除开机自启动..."
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "OpenClawAssistant"

  ; -----------------------------------------------------------------------
  ; 删除右键菜单
  ; -----------------------------------------------------------------------
  DetailPrint "正在删除右键菜单..."
  DeleteRegKey HKCR "Directory\Background\shell\OpenClawAssistant"

  ; -----------------------------------------------------------------------
  ; 删除快速启动快捷方式
  ; -----------------------------------------------------------------------
  DetailPrint "正在删除快捷方式..."
  Delete "$QUICKLAUNCH\OpenClaw Assistant.lnk"

  ; -----------------------------------------------------------------------
  ; 删除注册表条目
  ; -----------------------------------------------------------------------
  DetailPrint "正在清理注册表..."
  DeleteRegKey HKCU "Software\OpenClaw\Assistant"

  ; 如果 OpenClaw 键下没有其他子键，则删除父键
  DeleteRegKey /ifempty HKCU "Software\OpenClaw"

  DetailPrint "卸载完成!"
!macroend

; ============================================================================
; 安装完成后显示的页面
; ============================================================================

!macro customFinishPage
  ; 可以在这里添加自定义完成页面内容
!macroend

; ============================================================================
; 更新检查相关
; ============================================================================

!macro customCheckUpdate
  ; 检查更新的自定义逻辑
!macroend
