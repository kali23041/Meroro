// ioscap: captures a USB-connected iPhone/iPad screen on macOS (the same way QuickTime does) and writes
// H.264 + PCM to stdout for Meroro.
//   ioscap watch          → prints a JSON list of iOS screen devices whenever it changes
//   ioscap capture <id>   → streams packets: [type u8][flags u8][length u32 BE][payload]
//                            type 1 = H.264 SPS+PPS (Annex B), 2 = H.264 frame (Annex B, flags&1 = key frame), 3 = PCM s16le 48 kHz stereo
// Any AVCaptureDevice id works with `capture`, so it can be tested with a normal camera.
import AVFoundation
import CoreMediaIO
import Foundation
import VideoToolbox

setvbuf(stdout, nil, _IONBF, 0)
let out = FileHandle.standardOutput
let writeQ = DispatchQueue(label: "out")
func emit(_ type: UInt8, _ flags: UInt8, _ payload: Data) {
  var h = Data([type, flags]); var n = UInt32(payload.count).bigEndian
  h.append(Data(bytes: &n, count: 4)); h.append(payload)
  writeQ.async { out.write(h) }
}

// iOS devices only show up as capture devices after the process opts in.
func allowScreenDevices() {
  var prop = CMIOObjectPropertyAddress(mSelector: CMIOObjectPropertySelector(kCMIOHardwarePropertyAllowScreenCaptureDevices),
                                       mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
                                       mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
  var allow: UInt32 = 1
  CMIOObjectSetPropertyData(CMIOObjectID(kCMIOObjectSystemObject), &prop, 0, nil, UInt32(MemoryLayout<UInt32>.size), &allow)
}

func iosDevices() -> [[String: String]] {
  let types: [AVCaptureDevice.DeviceType] = { if #available(macOS 14.0, *) { return [.external] } else { return [.externalUnknown] } }()
  let all = AVCaptureDevice.DiscoverySession(deviceTypes: types, mediaType: .muxed, position: .unspecified).devices
  return all.filter { $0.modelID.contains("iOS") || $0.hasMediaType(.muxed) }.map { ["id": $0.uniqueID, "name": $0.localizedName, "model": $0.modelID] }
}

final class Capture: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, AVCaptureAudioDataOutputSampleBufferDelegate {
  let session = AVCaptureSession()
  let vq = DispatchQueue(label: "video"), aq = DispatchQueue(label: "audio")
  var enc: VTCompressionSession?
  var size = (0, 0)
  var lastConfig = Data()
  let aout = AVCaptureAudioDataOutput()

  func start(_ id: String) {
    guard let dev = AVCaptureDevice(uniqueID: id), let input = try? AVCaptureDeviceInput(device: dev) else { fputs("device not found\n", stderr); exit(2) }
    session.beginConfiguration()
    if session.canAddInput(input) { session.addInput(input) }
    let vout = AVCaptureVideoDataOutput()
    vout.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange]
    vout.alwaysDiscardsLateVideoFrames = true
    vout.setSampleBufferDelegate(self, queue: vq)
    if session.canAddOutput(vout) { session.addOutput(vout) }
    aout.audioSettings = [AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 2, AVLinearPCMBitDepthKey: 16,
                          AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false]
    aout.setSampleBufferDelegate(self, queue: aq)
    if session.canAddOutput(aout) { session.addOutput(aout) }
    session.commitConfiguration()
    session.startRunning()
    fputs("capturing \(dev.localizedName) auth=\(AVCaptureDevice.authorizationStatus(for: .video).rawValue) running=\(session.isRunning) inputs=\(session.inputs.count) outputs=\(session.outputs.count)\n", stderr)
  }

  func makeEncoder(_ w: Int, _ h: Int) {
    if let e = enc { VTCompressionSessionInvalidate(e) }
    var s: VTCompressionSession?
    VTCompressionSessionCreate(allocator: nil, width: Int32(w), height: Int32(h), codecType: kCMVideoCodecType_H264, encoderSpecification: nil,
                               imageBufferAttributes: nil, compressedDataAllocator: nil, outputCallback: nil, refcon: nil, compressionSessionOut: &s)
    guard let e = s else { return }
    VTSessionSetProperty(e, key: kVTCompressionPropertyKey_RealTime, value: kCFBooleanTrue)
    VTSessionSetProperty(e, key: kVTCompressionPropertyKey_ProfileLevel, value: kVTProfileLevel_H264_High_AutoLevel)
    VTSessionSetProperty(e, key: kVTCompressionPropertyKey_AllowFrameReordering, value: kCFBooleanFalse)
    VTSessionSetProperty(e, key: kVTCompressionPropertyKey_MaxKeyFrameInterval, value: 120 as CFNumber)
    VTSessionSetProperty(e, key: kVTCompressionPropertyKey_AverageBitRate, value: 14_000_000 as CFNumber)
    VTSessionSetProperty(e, key: kVTCompressionPropertyKey_ExpectedFrameRate, value: 60 as CFNumber)
    VTCompressionSessionPrepareToEncodeFrames(e)
    enc = e; size = (w, h); lastConfig = Data()
  }

  var n = 0
  func captureOutput(_ output: AVCaptureOutput, didOutput sb: CMSampleBuffer, from connection: AVCaptureConnection) {
    n += 1; if n == 1 || n == 60 { fputs("sample \(n)\n", stderr) }
    if output === aout { return audio(sb) }
    guard let img = CMSampleBufferGetImageBuffer(sb) else { return }
    let w = CVPixelBufferGetWidth(img), h = CVPixelBufferGetHeight(img)
    if enc == nil || size != (w, h) { makeEncoder(w, h) } // rotation changes the size
    guard let e = enc else { return }
    VTCompressionSessionEncodeFrame(e, imageBuffer: img, presentationTimeStamp: CMSampleBufferGetPresentationTimeStamp(sb), duration: .invalid,
                                    frameProperties: nil, infoFlagsOut: nil) { status, _, buf in
      if status == noErr, let buf = buf { self.packet(buf) }
    }
  }

  func packet(_ sb: CMSampleBuffer) {
    let att = CMSampleBufferGetSampleAttachmentsArray(sb, createIfNecessary: false) as? [[CFString: Any]]
    let key = !((att?.first?[kCMSampleAttachmentKey_NotSync] as? Bool) ?? false)
    let start = Data([0, 0, 0, 1])
    if key, let fmt = CMSampleBufferGetFormatDescription(sb) {
      var cfg = Data(), count = 0
      CMVideoFormatDescriptionGetH264ParameterSetAtIndex(fmt, parameterSetIndex: 0, parameterSetPointerOut: nil, parameterSetSizeOut: nil, parameterSetCountOut: &count, nalUnitHeaderLengthOut: nil)
      for i in 0..<count {
        var p: UnsafePointer<UInt8>?; var n = 0
        CMVideoFormatDescriptionGetH264ParameterSetAtIndex(fmt, parameterSetIndex: i, parameterSetPointerOut: &p, parameterSetSizeOut: &n, parameterSetCountOut: nil, nalUnitHeaderLengthOut: nil)
        if let p = p { cfg.append(start); cfg.append(p, count: n) }
      }
      if cfg != lastConfig { lastConfig = cfg; emit(1, 0, cfg) }
    }
    guard let bb = CMSampleBufferGetDataBuffer(sb) else { return }
    var len = 0; var ptr: UnsafeMutablePointer<Int8>?
    CMBlockBufferGetDataPointer(bb, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &len, dataPointerOut: &ptr)
    guard let base = ptr else { return }
    var annexB = Data(capacity: len + 16), i = 0
    base.withMemoryRebound(to: UInt8.self, capacity: len) { b in
      while i + 4 <= len { // AVCC (4-byte lengths) → Annex B start codes
        let n = Int(b[i]) << 24 | Int(b[i + 1]) << 16 | Int(b[i + 2]) << 8 | Int(b[i + 3]); i += 4
        if n <= 0 || i + n > len { break }
        annexB.append(start); annexB.append(b + i, count: n); i += n
      }
    }
    emit(2, key ? 1 : 0, annexB)
  }

  func audio(_ sb: CMSampleBuffer) {
    guard let bb = CMSampleBufferGetDataBuffer(sb) else { return }
    let len = CMBlockBufferGetDataLength(bb)
    var d = Data(count: len)
    d.withUnsafeMutableBytes { _ = CMBlockBufferCopyDataBytes(bb, atOffset: 0, dataLength: len, destination: $0.baseAddress!) }
    emit(3, 0, d)
  }
}

allowScreenDevices()
let args = CommandLine.arguments
if args.count > 1 && args[1] == "testpattern" { // debugging: moving gradient through the same encoder, no camera needed
  let c = Capture(); var f = 0
  Timer.scheduledTimer(withTimeInterval: 1.0 / 60, repeats: true) { _ in
    var pb: CVPixelBuffer?
    CVPixelBufferCreate(nil, 1280, 720, kCVPixelFormatType_32BGRA, [kCVPixelBufferIOSurfacePropertiesKey: [:]] as CFDictionary, &pb)
    guard let b = pb else { return }
    CVPixelBufferLockBaseAddress(b, []); let p = CVPixelBufferGetBaseAddress(b)!.assumingMemoryBound(to: UInt8.self), row = CVPixelBufferGetBytesPerRow(b)
    for y in 0..<720 { for x in 0..<1280 { let o = y * row + x * 4; p[o] = UInt8((x + f * 4) & 255); p[o + 1] = UInt8(y & 255); p[o + 2] = UInt8((f * 2) & 255); p[o + 3] = 255 } }
    CVPixelBufferUnlockBaseAddress(b, [])
    if c.enc == nil { c.makeEncoder(1280, 720) }
    VTCompressionSessionEncodeFrame(c.enc!, imageBuffer: b, presentationTimeStamp: CMTime(value: CMTimeValue(f), timescale: 60), duration: .invalid, frameProperties: nil, infoFlagsOut: nil) { st, _, sb in if st == noErr, let sb = sb { c.packet(sb) } }
    f += 1
  }
  withExtendedLifetime(c) { RunLoop.main.run() }
} else if args.count > 1 && args[1] == "cameras" { // debugging: every video device, so `capture` can be tested without an iPhone
  for d in AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInWideAngleCamera, .continuityCamera, .deskViewCamera], mediaType: .video, position: .unspecified).devices { print(d.uniqueID, "|", d.localizedName) }
  exit(0)
} else if args.count > 2 && args[1] == "capture" {
  let c = Capture()
  // device lists fill in a moment after opting in
  // capture needs camera permission (macOS asks on behalf of Meroro the first time)
  AVCaptureDevice.requestAccess(for: .video) { ok in
    if !ok { fputs("camera permission denied\n", stderr); exit(3) }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { c.start(args[2]) }
  }
  withExtendedLifetime(c) { RunLoop.main.run() }
} else {
  var last = ""
  Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
    let list = iosDevices()
    if let j = try? JSONSerialization.data(withJSONObject: list), let s = String(data: j, encoding: .utf8), s != last {
      last = s; print(s)
      if args.count > 1 && args[1] == "list" { exit(0) }
    }
  }
  RunLoop.main.run()
}
