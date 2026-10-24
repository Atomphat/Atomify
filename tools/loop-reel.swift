// Composite the frames from record-loop.mjs into the 1920x1080 looping reel:
// the page sits in a rounded window on tangerine, with vertical motion blur that follows scroll speed.
// usage: swift tools/loop-reel.swift frames_dir out.mp4
import AVFoundation
import AppKit
import CoreImage

let a = CommandLine.arguments
let dir = URL(fileURLWithPath: a[1]), out = URL(fileURLWithPath: a[2])
let meta = try JSONSerialization.jsonObject(with: Data(contentsOf: dir.appendingPathComponent("meta.json"))) as! [String: Any]
let speeds = (meta["speeds"] as! [NSNumber]).map { CGFloat(truncating: $0) }
let fps = Int32(truncating: meta["fps"] as! NSNumber)
let files = try FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasSuffix(".jpg") }.sorted()

let W = 1920, H = 1080, SCALE: CGFloat = 0.82, RADIUS: CGFloat = 22
let tang = CGColor(red: 0xec / 255, green: 0x4d / 255, blue: 0x0e / 255, alpha: 1)
let ci = CIContext(options: [.useSoftwareRenderer: false])

try? FileManager.default.removeItem(at: out)
let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 14_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel],
])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H,
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

for (i, f) in files.enumerated() {
  guard let src = CIImage(contentsOf: dir.appendingPathComponent(f)) else { continue }
  // blur along the scroll direction, stronger the faster the page moves
  let v = abs(i < speeds.count ? speeds[i] : 0)
  var img = src
  if v > 2 {
    img = src.clampedToExtent().applyingFilter("CIMotionBlur", parameters: [kCIInputRadiusKey: min(v * 0.32, 70), kCIInputAngleKey: CGFloat.pi / 2]).cropped(to: src.extent)
  }
  let page = ci.createCGImage(img, from: src.extent)!

  while !input.isReadyForMoreMediaData { usleep(2000) }
  var pb: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
  CVPixelBufferLockBaseAddress(pb!, [])
  let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb!), width: W, height: H, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb!),
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  ctx.setFillColor(tang)
  ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
  let w = CGFloat(W) * SCALE, h = w * CGFloat(page.height) / CGFloat(page.width)
  let rect = CGRect(x: (CGFloat(W) - w) / 2, y: (CGFloat(H) - h) / 2, width: w, height: h)
  let path = CGPath(roundedRect: rect, cornerWidth: RADIUS, cornerHeight: RADIUS, transform: nil)
  ctx.saveGState()
  ctx.setShadow(offset: CGSize(width: 0, height: -26), blur: 60, color: CGColor(red: 0.25, green: 0.06, blue: 0, alpha: 0.45))
  ctx.addPath(path); ctx.setFillColor(.white); ctx.fillPath()
  ctx.restoreGState()
  ctx.saveGState()
  ctx.addPath(path); ctx.clip()
  ctx.interpolationQuality = .high
  ctx.draw(page, in: rect)
  ctx.restoreGState()
  CVPixelBufferUnlockBaseAddress(pb!, [])
  adaptor.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps))
  if i % 90 == 0 { print("frame \(i)/\(files.count)") }
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print("wrote \(out.path) \(files.count) frames \(W)x\(H) @\(fps)fps")
