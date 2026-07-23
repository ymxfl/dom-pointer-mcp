---
"@dom-pointer-mcp/server": minor
"@dom-pointer-mcp/chrome-extension": minor
---

新增粘贴参考图功能：可在 note panel 里 `Ctrl/Cmd+V` 粘贴任意外部截图作为参考图，支持多张、显示缩略图并可删除，粘贴时自动降采样（最长边 1600、jpeg 0.8）。参考图随选区一起发送、进入选择历史，并作为独立于选区截图的 `referenceImages` 字段返回给 agent（每张带独立标签，用途以 userNote 描述为准），典型场景是"参考这张图的样式修改选区"。Copy 仍为纯文本旁路，不含参考图。
