#!/bin/bash

# Voice Recognition 토글 스크립트
# GUI 환경에서 안전하게 실행되도록 설계

# PATH 설정 (GUI 환경에서 필요)
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

# 토글 파일 생성
/bin/touch /tmp/voice-recognition-toggle

# 로그 기록 (디버깅용)
/bin/echo "$(date): Voice recognition toggle triggered from GUI shortcut" >> /tmp/voice-recognition.log 