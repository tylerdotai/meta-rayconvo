#!/bin/bash
# Setup Piper TTS models for RayConvo
# Usage: bash scripts/setup-piper.sh

MODEL_DIR="/tmp/rayconvo/piper_models"
mkdir -p "$MODEL_DIR"
cd "$MODEL_DIR"

# Try rhasspy/piper voice models from the official release
# These are on GitHub under rhasspy/piper/releases/download/v1.2.0/
VOICE="en_US-ryan-medium"
BASE="https://github.com/rhasspy/piper/releases/download/v1.2.0"

for ext in onnx onnx.json; do
  file="${VOICE}.${ext}"
  if [ ! -f "$file" ]; then
    echo "Downloading $file..."
    curl -sL "$BASE/$file" -o "$file"
    echo "  $(du -h $file | cut -f1)"
  else
    echo "$file already present"
  fi
done

echo "Piper models ready in $MODEL_DIR:"
ls -lh "$MODEL_DIR"
