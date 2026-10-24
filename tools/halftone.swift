// Cut the person out of a photo (Vision), turn it into a newspaper halftone
// with a thick hand-cut white border, and save a transparent PNG.
// usage: swift tools/halftone.swift in.jpg out.png [dot=9]
import AppKit
import CoreImage
import Vision

let args = CommandLine.arguments
let inURL = URL(fileURLWithPath: args[1]), outURL = URL(fileURLWithPath: args[2])
let dot = args.count > 3 ? CGFloat(Double(args[3])!) : 9
let ctx = CIContext()

var src = CIImage(contentsOf: inURL, options: [.applyOrientationProperty: true])!
// work at ~1400px tall
let scale = 1400 / src.extent.height
src = src.transformed(by: .init(scaleX: scale, y: scale))
let cg = ctx.createCGImage(src, from: src.extent)!

let req = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: cg)
try handler.perform([req])
guard let obs = req.results?.first else { fatalError("no person found") }
let maskPB = try obs.generateScaledMaskForImage(forInstances: obs.allInstances, from: handler)
var mask = CIImage(cvPixelBuffer: maskPB)

// crop to the subject with some margin for the border
let maskCG = ctx.createCGImage(mask, from: mask.extent)!
let w = maskCG.width, h = maskCG.height
var px = [UInt8](repeating: 0, count: w * h)
let gctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: 0)!
gctx.draw(maskCG, in: CGRect(x: 0, y: 0, width: w, height: h))
var minX = w, minY = h, maxX = 0, maxY = 0
for y in 0..<h { for x in 0..<w where px[y * w + x] > 128 { minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y) } }
let pad = 40
// bitmap rows are top-down; CI is bottom-up
let crop = CGRect(x: max(0, minX - pad), y: max(0, h - maxY - 1 - pad), width: min(w, maxX + pad) - max(0, minX - pad), height: min(h, h - minY + pad) - max(0, h - maxY - 1 - pad))

// grayscale, punchy contrast
let gray = src.applyingFilter("CIColorControls", parameters: [kCIInputSaturationKey: 0, kCIInputContrastKey: 1.0])
let grayCG = ctx.createCGImage(gray, from: crop)!
let cw = grayCG.width, ch = grayCG.height
var g = [UInt8](repeating: 0, count: cw * ch)
CGContext(data: &g, width: cw, height: ch, bitsPerComponent: 8, bytesPerRow: cw, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: 0)!
  .draw(grayCG, in: CGRect(x: 0, y: 0, width: cw, height: ch))

// auto-levels inside the person: stretch 3rd..97th percentile, then lift midtones
var mk = [UInt8](repeating: 0, count: cw * ch)
CGContext(data: &mk, width: cw, height: ch, bitsPerComponent: 8, bytesPerRow: cw, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: 0)!
  .draw(ctx.createCGImage(mask, from: crop)!, in: CGRect(x: 0, y: 0, width: cw, height: ch))
var hist = [Int](repeating: 0, count: 256), n = 0
for i in 0..<(cw * ch) where mk[i] > 128 { hist[Int(g[i])] += 1; n += 1 }
func pct(_ q: Double) -> Int { var acc = 0; for (i, c) in hist.enumerated() { acc += c; if Double(acc) >= q * Double(n) { return i } }; return 255 }
let lo = Double(pct(0.03)), hi = Double(max(pct(0.97), pct(0.03) + 1))
let gamma = args.count > 4 ? Double(args[4])! : 0.7
for i in 0..<g.count {
  let t = min(1, max(0, (Double(g[i]) - lo) / (hi - lo)))
  g[i] = UInt8(pow(t, gamma) * 255)
}

// border = mask grown by ~22px (alternating square/cross passes ≈ octagon), as a gray image
func grow(_ src: [UInt8], _ r: Int, diag: Bool) -> [UInt8] {
  var a = src, b = src
  // horizontal then vertical running max (square); cross = only one axis per pass
  for y in 0..<ch { for x in 0..<cw { var m: UInt8 = 0; for d in -r...r { let xx = x + d; if xx >= 0, xx < cw { m = max(m, a[y * cw + xx]) } }; b[y * cw + x] = m } }
  if diag { a = b } else { a = src.indices.map { max(b[$0], src[$0]) } }
  for y in 0..<ch { for x in 0..<cw { var m: UInt8 = 0; for d in -r...r { let yy = y + d; if yy >= 0, yy < ch { m = max(m, (diag ? a : src)[yy * cw + x]) } }; b[y * cw + x] = diag ? m : max(m, a[y * cw + x]) } }
  return b
}
var bd = mk.map { $0 > 128 ? UInt8(255) : 0 }
bd = grow(bd, 8, diag: true); bd = grow(bd, 11, diag: false); bd = grow(bd, 6, diag: true)
let borderCG = CGContext(data: &bd, width: cw, height: ch, bitsPerComponent: 8, bytesPerRow: cw, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: 0)!.makeImage()!
var mkc = mk
let maskCropCG = CGContext(data: &mkc, width: cw, height: ch, bitsPerComponent: 8, bytesPerRow: cw, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: 0)!.makeImage()!

let out = CGContext(data: nil, width: cw, height: ch, bitsPerComponent: 8, bytesPerRow: cw * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
let full = CGRect(x: 0, y: 0, width: cw, height: ch)
// white paper border
out.saveGState(); out.clip(to: full, mask: borderCG)
out.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1)); out.fill(full)
out.restoreGState()
// halftone dots inside the person, 45° screen
out.saveGState(); out.clip(to: full, mask: maskCropCG)
out.setFillColor(CGColor(red: 0.08, green: 0.07, blue: 0.06, alpha: 1))
let ang = CGFloat.pi / 4, ca = cos(ang), sa = sin(ang)
let diag = CGFloat(max(cw, ch)) * 1.5
var u = -diag
while u < diag {
  var v = -diag
  while v < diag {
    let x = u * ca - v * sa + CGFloat(cw) / 2, y = u * sa + v * ca + CGFloat(ch) / 2
    if x >= 0, y >= 0, x < CGFloat(cw), y < CGFloat(ch) {
      let lum = CGFloat(g[(ch - 1 - Int(y)) * cw + Int(x)]) / 255
      let r = dot * 0.72 * sqrt(max(0, 1 - lum))
      if r > 0.4 { out.fillEllipse(in: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)) }
    }
    v += dot
  }
  u += dot
}
out.restoreGState()

let rep = NSBitmapImageRep(cgImage: out.makeImage()!)
try rep.representation(using: .png, properties: [:])!.write(to: outURL)
print("wrote \(outURL.path) \(cw)x\(ch)")
