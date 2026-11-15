// mousebtn: prints "1" when the left mouse button goes down anywhere on the Mac and "0" when it is released.
// It only polls the button state (no event tap), so it needs no Accessibility permission.
import CoreGraphics
import Foundation
setvbuf(stdout, nil, _IONBF, 0)
var last = false
while true {
  let d = CGEventSource.buttonState(.combinedSessionState, button: .left)
  if d != last { last = d; print(d ? "1" : "0") }
  usleep(8000)
}
