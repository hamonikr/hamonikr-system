# Voice Recognition Engines Guide

This applet supports multiple speech recognition engines. Choose the one that best fits your needs:

## 🌐 **Whisper Server** (Default)
- **Description**: Custom Whisper server deployment
- **Setup**: Configure server URL in settings
- **Pros**: Fast, customizable, works offline if local server
- **Cons**: Requires server setup
- **Example URL**: `https://api.hamonize.com/whisper/inference`

## 🤖 **OpenAI Whisper API**
- **Description**: Official OpenAI Whisper API service
- **Setup**: 
  1. Get API key from https://platform.openai.com/api-keys
  2. Enter API key in settings
- **Pros**: High accuracy, reliable
- **Cons**: Requires internet, costs money per usage
- **Installation**: `pip3 install openai`

## ☁️ **Google Cloud Speech**
- **Description**: Google's Speech-to-Text API
- **Setup**:
  1. Create project at https://console.cloud.google.com/
  2. Enable Speech-to-Text API
  3. Create service account and download JSON key
  4. Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
- **Pros**: Very accurate, supports many languages
- **Cons**: Requires internet, costs money
- **Installation**: `pip3 install google-cloud-speech`

## 📱 **Vosk (Offline)**
- **Description**: Offline speech recognition
- **Setup**:
  1. Install Vosk: `pip3 install vosk`
  2. Download model: 
     - Korean: https://alphacephei.com/vosk/models/vosk-model-small-ko-0.22.zip
     - English: https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
  3. Extract to `/usr/share/vosk-models/` or custom path
  4. Select model path in settings
- **Pros**: Works offline, no costs, privacy-friendly
- **Cons**: Lower accuracy than cloud services
- **Installation**: `sudo apt install python3-vosk`

## 🏠 **Local Whisper**
- **Description**: Local OpenAI Whisper installation
- **Setup**:
  1. Install: `pip3 install openai-whisper`
  2. Download models automatically on first use
- **Pros**: Works offline, high accuracy, no costs after setup
- **Cons**: Requires powerful hardware, slow on CPU
- **Installation**: `pip3 install openai-whisper`

## 📋 **Installation Commands**

### Ubuntu/Debian:
```bash
# For Vosk
sudo apt install python3-vosk
wget https://alphacephei.com/vosk/models/vosk-model-small-ko-0.22.zip
unzip vosk-model-small-ko-0.22.zip -d /usr/share/vosk-models/

# For OpenAI API
pip3 install openai

# For Google Cloud
pip3 install google-cloud-speech

# For Local Whisper
pip3 install openai-whisper
```

## 🔧 **Configuration Tips**

1. **For Privacy**: Use Vosk or Local Whisper
2. **For Accuracy**: Use Google Cloud Speech or OpenAI API
3. **For Speed**: Use Whisper Server with local deployment
4. **For Korean**: Vosk Korean model works well offline

## 🆘 **Troubleshooting**

- **No audio detected**: Check microphone permissions and ALSA settings
- **API errors**: Verify API keys and internet connection
- **Vosk not working**: Ensure model path is correct and readable
- **Local Whisper slow**: Consider using GPU acceleration with CUDA

## 📖 **More Information**

- OpenAI Whisper: https://github.com/openai/whisper
- Vosk: https://alphacephei.com/vosk/
- Google Cloud Speech: https://cloud.google.com/speech-to-text
