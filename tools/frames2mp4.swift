// Encode a folder of numbered JPEG frames into an H.264 MP4.
// usage: swift tools/frames2mp4.swift frames_dir out.mp4 [fps=30]
import AVFoundation
import AppKit

let a = CommandLine.arguments
let dir = URL(fileURLWithPath: a[1]), out = URL(fileURLWithPath: a[2])
let fps = Int32(a.count > 3 ? Int(a[3])! : 30)
let files = try FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasSuffix(".jpg") }.sorted()
guard let first = NSImage(contentsOf: dir.appendingPathComponent(files[0]))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fatalError("no frames") }
let w = first.width, h = first.height
try? FileManager.default.removeItem(at: out)
let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: w, AVVideoHeightKey: h,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 6_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel],
])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h,
])
writer.add(input)
writer.startWriting(); writer.startSession(atSourceTime: .zero)
for (i, f) in files.enumerated() {
  autoreleasepool {
    let img = NSImage(contentsOf: dir.appendingPathComponent(f))!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
    var pb: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
    CVPixelBufferLockBaseAddress(pb!, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb!), width: w, height: h, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb!),
                        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    CVPixelBufferUnlockBaseAddress(pb!, [])
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
    adaptor.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps))
  }
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print("wrote \(out.path) \(files.count) frames \(w)x\(h) @\(fps)fps", writer.error ?? "")
