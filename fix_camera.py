
import os

file_path = r'd:\farmer app with sql\frontend-react\src\pages\CustomerDashboard.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# The specific block to replace
# We use fragments to be safe
old_block = '''{showCamera && (
                        <div className="camera-overlay">'''

# Let's find the showCamera block and replace its interior
new_camera_ui = '''{showCamera && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                          <div className="camera-container-small">
                            <video ref={videoRef} autoPlay playsInline className="camera-viewfinder" />
                            <div className="shutter-flash" id="shutterFlash"></div>
                            <div className="camera-controls">
                              <button type="button" className="camera-close" onClick={stopCamera}>✕</button>
                              <button type="button" className="btn-shutter" onClick={capturePhoto}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}'''

# Search for the starting point and ending point manually to avoid whitespace match issues
start_marker = '{showCamera && ('
end_marker = ')}'

start_idx = content.find(start_marker)
if start_idx != -1:
    # Check if this is the camera block (contains camera-overlay)
    if 'camera-overlay' in content[start_idx:start_idx+200]:
        end_idx = content.find(end_marker, start_idx) + 2
        new_content = content[:start_idx] + new_camera_ui + content[end_idx:]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Successfully updated CustomerDashboard.jsx camera UI")
    else:
        print("Camera overlay string not found in the block")
else:
    print("showCamera marker not found")
