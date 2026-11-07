import Foundation
import CoreGraphics
import ImageIO

let srcPath = CommandLine.arguments[1]
let dstPath = CommandLine.arguments[2]

guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: srcPath) as CFURL, nil),
      let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
    fatalError("无法读取源图: \(srcPath)")
}

let W = cg.width
let H = cg.height
let cs = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0,
                    space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.clear(CGRect(x: 0, y: 0, width: W, height: H))

// 超椭圆（squircle）路径 —— 近似 macOS 图标连续曲率
let a = CGFloat(W) / 2
let b = CGFloat(H) / 2
let n: CGFloat = 5.0
var pts: [CGPoint] = []
let steps = 720
for i in 0...steps {
    let t = CGFloat(i) / CGFloat(steps) * 2 * .pi
    let ct = cos(t), st = sin(t)
    let x = a * copysign(pow(abs(ct), 2 / n), ct)
    let y = b * copysign(pow(abs(st), 2 / n), st)
    pts.append(CGPoint(x: a + x, y: b + y))
}
let path = CGMutablePath()
path.addLines(between: pts)
path.closeSubpath()

// 1) 投影轮廓（落在圆角形状外侧，制造悬浮层次感）
ctx.saveGState()
let shadowColor = CGColor(colorSpace: cs, components: [0, 0, 0, 0.35])!
ctx.setShadow(offset: CGSize(width: 0, height: -CGFloat(H) * 0.02),
              blur: CGFloat(H) * 0.045, color: shadowColor)
ctx.addPath(path)
ctx.fillPath()
ctx.restoreGState()

// 2) 裁切到圆角并绘制原图
ctx.saveGState()
ctx.addPath(path)
ctx.clip()
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))

// 3) 顶部柔和高光，增强立体感（仅在上半部，随裁切生效）
let topColor = CGColor(colorSpace: cs, components: [1, 1, 1, 0.16])!
let clearColor = CGColor(colorSpace: cs, components: [1, 1, 1, 0])!
let grad = CGGradient(colorsSpace: cs, colors: [topColor, clearColor] as CFArray,
                      locations: [0.0, 0.55])!
ctx.drawLinearGradient(grad, start: CGPoint(x: 0, y: CGFloat(H)),
                       end: CGPoint(x: 0, y: CGFloat(H) * 0.45), options: [])
ctx.restoreGState()

// 4) 极细内描边，避免边缘发虚
ctx.saveGState()
ctx.addPath(path)
ctx.setLineWidth(CGFloat(max(1, W / 512)))
ctx.setStrokeColor(CGColor(colorSpace: cs, components: [0, 0, 0, 0.18])!)
ctx.strokePath()
ctx.restoreGState()

guard let out = ctx.makeImage() else { fatalError("生成图像失败") }
guard let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: dstPath) as CFURL, kUTTypePNG, 1, nil) else {
    fatalError("无法创建输出: \(dstPath)")
}
CGImageDestinationAddImage(dest, out, nil)
CGImageDestinationFinalize(dest)
print("已生成圆角图标 → \(dstPath)  (\(W)x\(H))")
