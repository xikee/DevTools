import AppKit

/// 构建应用主菜单。
///
/// 重要：macOS 上的标准快捷键（⌘C 复制 / ⌘V 粘贴 / ⌘X 剪切 / ⌘A 全选 / ⌘Z 撤销）
/// 是通过主菜单的 key equivalent 分发到响应链（responder chain）上的。
/// 如果 App 没有主菜单，这些快捷键就没有任何触发路径，
/// 典型症状是「能正常打字，但 ⌘V 粘贴毫无反应」。
/// 因此任何 AppKit App 都必须设置主菜单，即使界面完全由 WKWebView 承载。
func buildMainMenu(appName: String) -> NSMenu {
    let mainMenu = NSMenu()

    // ---------- 应用菜单 ----------
    let appItem = NSMenuItem()
    appItem.title = appName
    mainMenu.addItem(appItem)
    let appMenu = NSMenu(title: appName)
    appMenu.addItem(withTitle: "关于 \(appName)",
                    action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
                    keyEquivalent: "")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "隐藏 \(appName)",
                    action: #selector(NSApplication.hide(_:)),
                    keyEquivalent: "h")
    let hideOthers = appMenu.addItem(withTitle: "隐藏其他",
                                     action: #selector(NSApplication.hideOtherApplications(_:)),
                                     keyEquivalent: "h")
    hideOthers.keyEquivalentModifierMask = [.command, .option]
    appMenu.addItem(withTitle: "显示全部",
                    action: #selector(NSApplication.unhideAllApplications(_:)),
                    keyEquivalent: "")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "退出 \(appName)",
                    action: #selector(NSApplication.terminate(_:)),
                    keyEquivalent: "q")
    appItem.submenu = appMenu

    // ---------- 编辑菜单（核心：为 WKWebView 提供标准编辑快捷键）----------
    let editItem = NSMenuItem()
    editItem.title = "编辑"
    mainMenu.addItem(editItem)
    let editMenu = NSMenu(title: "编辑")
    editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
    // 大写 Z 即隐含 Shift，对应 ⌘⇧Z 重做
    editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "Z")
    editMenu.addItem(.separator())
    editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    editMenu.addItem(withTitle: "拷贝", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    editItem.submenu = editMenu

    // ---------- 窗口菜单 ----------
    let winItem = NSMenuItem()
    winItem.title = "窗口"
    mainMenu.addItem(winItem)
    let winMenu = NSMenu(title: "窗口")
    winMenu.addItem(withTitle: "最小化",
                    action: #selector(NSWindow.performMiniaturize(_:)),
                    keyEquivalent: "m")
    winMenu.addItem(withTitle: "缩放",
                    action: #selector(NSWindow.performZoom(_:)),
                    keyEquivalent: "")
    winMenu.addItem(.separator())
    winMenu.addItem(withTitle: "关闭窗口",
                    action: #selector(NSWindow.performClose(_:)),
                    keyEquivalent: "w")
    winItem.submenu = winMenu
    // 注册为窗口菜单，macOS 才能自动维护窗口列表
    NSApp.windowsMenu = winMenu

    return mainMenu
}
