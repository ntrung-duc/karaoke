"""Offline pose extraction. Install mediapipe and opencv-python before running."""
import argparse
import json
import sys
from pathlib import Path

# Optional isolated tool installation; no runtime/browser dependency.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '.tmp/video-tools'))
import cv2
import mediapipe as mp

parser = argparse.ArgumentParser()
parser.add_argument('video')
parser.add_argument('model')
parser.add_argument('output')
args = parser.parse_args()
options = mp.tasks.vision.PoseLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=args.model),
    running_mode=mp.tasks.vision.RunningMode.VIDEO, num_poses=3,
    min_pose_detection_confidence=.5, min_tracking_confidence=.5)
cap = cv2.VideoCapture(args.video)
fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
indices = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]
with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
    i = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        # Center crop isolates the dancer from pedestrians crossing the scene.
        rgb = cv2.cvtColor(frame[140:960, 620:1280], cv2.COLOR_BGR2RGB)
        result = detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), round(i/fps*1000))
        if result.pose_landmarks:
            best = min(range(len(result.pose_landmarks)), key=lambda j: abs((result.pose_landmarks[j][23].x+result.pose_landmarks[j][24].x)/2-.5))
            pose = result.pose_world_landmarks[best]
            frames.append({'t': round(i/fps, 4), 'p': [[round(pose[j].x,4),round(-pose[j].y,4),round(pose[j].z,4)] for j in indices]})
        i += 1
cap.release()
Path(args.output).write_text(json.dumps({'source':'User-provided Peter Parker dance video; MediaPipe world-pose extraction', 'indices':indices,'duration':round(i/fps,4),'frames':frames},separators=(',',':')),encoding='utf-8')
print(f'{len(frames)}/{i} frames extracted, {i/fps:.2f}s')
