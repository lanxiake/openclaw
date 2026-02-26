package com.yunkun.mtbot.android.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class MtBotProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", MtBotCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", MtBotCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", MtBotCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", MtBotCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", MtBotCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", MtBotCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", MtBotCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", MtBotCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", MtBotCapability.Canvas.rawValue)
    assertEquals("camera", MtBotCapability.Camera.rawValue)
    assertEquals("screen", MtBotCapability.Screen.rawValue)
    assertEquals("voiceWake", MtBotCapability.VoiceWake.rawValue)
  }

  @Test
  fun screenCommandsUseStableStrings() {
    assertEquals("screen.record", MtBotScreenCommand.Record.rawValue)
  }
}
