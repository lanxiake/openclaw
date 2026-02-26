package com.yunkun.mtbot.android.ui

import androidx.compose.runtime.Composable
import com.yunkun.mtbot.android.MainViewModel
import com.yunkun.mtbot.android.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
