#!/usr/bin/env python3
"""
OpenCV credit-card detection for Path A frame filtering.

Image mode:  positional JPEG paths (optionally --rotate-cw before paths)
Video mode:  --video <path> [--fps 2] [--save-dir <dir>] [--rotate-cw]

Output: JSON array, one object per frame
  {path, frameIdx, timeSec, cardDetected, isOrthogonal, angleDev,
   areaFrac, aspectRatio, sharpness, rotationAngle}

In video mode frames are saved to --save-dir (default: temp dir).
Card frames are rotated to horizontal before saving.
"""
import sys
import json
import math
import os
import tempfile
import numpy as np

try:
    import cv2
except ImportError:
    print(json.dumps({"error": "opencv not installed", "fix": "pip3 install opencv-python-headless"}), flush=True)
    sys.exit(1)

ASPECT_MIN = 1.4
ASPECT_MAX = 1.8
MIN_AREA_FRAC = 0.004
MAX_AREA_FRAC = 0.50
ORTHOGONAL_MAX_DEV = 20  # degrees

def _angle_deviation(pts):
    devs = []
    for i in range(4):
        v1 = pts[(i - 1) % 4] - pts[i]
        v2 = pts[(i + 1) % 4] - pts[i]
        n1 = np.linalg.norm(v1)
        n2 = np.linalg.norm(v2)
        if n1 < 1e-9 or n2 < 1e-9:
            continue
        cos_a = float(np.dot(v1, v2) / (n1 * n2))
        cos_a = max(-1.0, min(1.0, cos_a))
        devs.append(abs(math.degrees(math.acos(cos_a)) - 90.0))
    return max(devs) if devs else 90.0

def _laplacian(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())

def _card_rotation_angle(contour):
    """Angle (degrees) to rotate image so the card's long axis is horizontal."""
    rect = cv2.minAreaRect(contour)
    w, h = rect[1]
    angle = rect[2]  # [-90, 0)
    if w < h:
        angle += 90
    return angle

def _rotate_to_horizontal(img, contour):
    """Rotate image to align detected card's long axis with horizontal axis."""
    angle = _card_rotation_angle(contour)
    if abs(angle) < 0.5:
        return img, 0.0
    ih, iw = img.shape[:2]
    M = cv2.getRotationMatrix2D((iw // 2, ih // 2), angle, 1.0)
    rotated = cv2.warpAffine(img, M, (iw, ih),
                             flags=cv2.INTER_LINEAR,
                             borderMode=cv2.BORDER_REPLICATE)
    return rotated, round(angle, 1)

def detect_card(img):
    """Detect credit card in image. Returns (result_dict, best_contour)."""
    h, w = img.shape[:2]
    area_total = w * h
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    best = None
    best_contour = None
    for lo, hi in [(30, 100), (50, 150), (10, 60)]:
        edges = cv2.Canny(blur, lo, hi)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, kernel, iterations=1)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for c in contours:
            area = cv2.contourArea(c)
            area_frac = area / area_total
            if area_frac < MIN_AREA_FRAC or area_frac > MAX_AREA_FRAC:
                continue
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.03 * peri, True)
            if len(approx) != 4:
                continue
            rect = cv2.minAreaRect(c)
            rw, rh = sorted(rect[1])
            if rw < 1:
                continue
            ratio = rh / rw
            if not (ASPECT_MIN <= ratio <= ASPECT_MAX):
                continue
            pts = approx.reshape(4, 2).astype(float)
            ang_dev = _angle_deviation(pts)
            if best is None or area_frac > best['areaFrac']:
                best = {
                    'cardDetected': True,
                    'isOrthogonal': ang_dev < ORTHOGONAL_MAX_DEV,
                    'angleDev': round(ang_dev, 1),
                    'areaFrac': round(float(area_frac), 5),
                    'aspectRatio': round(float(ratio), 3),
                }
                best_contour = c

    if best:
        return best, best_contour
    return {'cardDetected': False, 'isOrthogonal': False, 'angleDev': 90.0,
            'areaFrac': 0.0, 'aspectRatio': 0.0}, None

def process_path(fpath, idx, rotate_cw):
    img = cv2.imread(fpath)
    if img is None:
        return {'path': fpath, 'frameIdx': idx, 'timeSec': 0.0,
                'cardDetected': False, 'isOrthogonal': False,
                'angleDev': 90.0, 'areaFrac': 0.0, 'aspectRatio': 0.0,
                'sharpness': 0.0, 'rotationAngle': 0.0, 'error': 'cannot read'}
    if rotate_cw:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    result, _ = detect_card(img)
    result['sharpness'] = round(_laplacian(img), 1)
    result['rotationAngle'] = 0.0
    result['path'] = fpath
    result['frameIdx'] = idx
    result['timeSec'] = 0.0
    return result

def scan_video(video_path, target_fps, save_dir, rotate_cw):
    """Extract frames at target_fps, detect card, rotate card frames to horizontal."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise IOError(f'Cannot open video: {video_path}')

    # Auto-apply rotation metadata (iPhone portrait videos)
    cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_interval = max(1, round(video_fps / target_fps))

    os.makedirs(save_dir, exist_ok=True)

    results = []
    raw_idx = 0
    out_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if raw_idx % frame_interval == 0:
            if rotate_cw:
                frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)

            result, contour = detect_card(frame)
            result['sharpness'] = round(_laplacian(frame), 1)
            result['frameIdx'] = out_idx
            result['timeSec'] = round(raw_idx / video_fps, 2)

            out_path = os.path.join(save_dir, f'frame_{out_idx}.jpg')
            if result['cardDetected'] and contour is not None:
                rotated, rot_angle = _rotate_to_horizontal(frame, contour)
                cv2.imwrite(out_path, rotated, [cv2.IMWRITE_JPEG_QUALITY, 90])
                result['rotationAngle'] = rot_angle
            else:
                cv2.imwrite(out_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                result['rotationAngle'] = 0.0

            result['path'] = out_path
            results.append(result)
            out_idx += 1

        raw_idx += 1

    cap.release()
    return results

def main():
    args = sys.argv[1:]
    rotate_cw = False
    if '--rotate-cw' in args:
        rotate_cw = True
        args = [a for a in args if a != '--rotate-cw']

    # Video mode
    if '--video' in args:
        idx = args.index('--video')
        video_path = args[idx + 1]

        target_fps = 2.0
        if '--fps' in args:
            fps_idx = args.index('--fps')
            target_fps = float(args[fps_idx + 1])

        save_dir = None
        if '--save-dir' in args:
            dir_idx = args.index('--save-dir')
            save_dir = args[dir_idx + 1]
        else:
            save_dir = tempfile.mkdtemp(prefix='card_frames_')

        results = scan_video(video_path, target_fps, save_dir, rotate_cw)
        print(json.dumps(results), flush=True)
        return

    # Image mode
    if not args:
        print(json.dumps([]), flush=True)
        return

    results = [process_path(p, i, rotate_cw) for i, p in enumerate(args)]
    print(json.dumps(results), flush=True)

if __name__ == '__main__':
    main()
