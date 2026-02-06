; OpenClaw Assistant NSIS Installer Script
; Custom installer configuration

!macro customHeader
  ; Custom header macros
!macroend

!macro preInit
  ; Pre-initialization
  SetRegView 64
!macroend

!macro customInit
  ; Custom initialization
!macroend

!macro customInstall
  ; Create application data directory
  CreateDirectory "$APPDATA\OpenClaw Assistant"

  ; Write uninstall info
  WriteRegStr HKCU "Software\OpenClaw\Assistant" "InstallPath" "$INSTDIR"
  WriteRegStr HKCU "Software\OpenClaw\Assistant" "Version" "${VERSION}"
!macroend

!macro customUnInstall
  ; Remove application data (optional, ask user)
  MessageBox MB_YESNO "是否删除用户数据和配置文件？" IDNO SkipRemoveData
    RMDir /r "$APPDATA\OpenClaw Assistant"
  SkipRemoveData:

  ; Remove registry entries
  DeleteRegKey HKCU "Software\OpenClaw\Assistant"
!macroend
