
import os

def fix_customer_dashboard():
    path = r'd:\farmer app with sql\frontend-react\src\pages\CustomerDashboard.jsx'
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix console error
    old_img = 'src={photoPreview || getFullImageUrl(user.profile_photo) || \'\'}'
    new_img = 'src={photoPreview || getFullImageUrl(user.profile_photo) || undefined}'
    content = content.replace(old_img, new_img)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed CustomerDashboard.jsx console error")

def fix_farmer_dashboard():
    path = r'd:\farmer app with sql\frontend-react\src\pages\FarmerDashboard.jsx'
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Add useEffect for camera (if not already present in the right way)
    # We remove the inline assignment
    content = content.replace('if (videoRef.current) videoRef.current.srcObject = stream;', '')
    
    # Add the effect before the return (find a good place)
    effect_code = '''
  // Attach camera stream when browser renders the <video> element
  useEffect(() => {
    if (showCamera && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [showCamera, cameraStream]);

  if (!user) return null;'''
    
    if 'srcObject = cameraStream' not in content:
        content = content.replace('if (!user) return null;', effect_code)
    
    # 2. Fix the camera UI to compact mode
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
    
    # Find and replace the whole showCamera block
    import re
    # We use a non-greedy regex to find the showCamera block
    pattern = re.compile(r'\{showCamera && \(.*?\}\)\}', re.DOTALL)
    content = pattern.sub(new_camera_ui, content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed FarmerDashboard.jsx camera UI and logic")

fix_customer_dashboard()
fix_farmer_dashboard()
