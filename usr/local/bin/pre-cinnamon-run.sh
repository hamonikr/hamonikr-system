#!/bin/bash

# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Setting Themes for HamoniKR OS
# 
# 이 프로그램은 윈도우 환경으로 로그인 하기 이전 단계에서
# 사용자 권한으로 실행해야 하는 영역의 기능을 처리합니다.
# 
# Copyright 2022 HamoniKR Team. All rights reserved.

if [ "$EUID" = 0 ]; then
    echo "Run with user authority. (EUID : $EUID)"
    exit 1
fi

# Create necessary directories if they do not exist
mkdir -p "/home/${USER}/.hamonikr/"
mkdir -p "/home/${USER}/.config/autostart/"

log() {
    # stdout
    echo "$1"
    # write to logfile
    log_dir="$HOME/.hamonikr/log"
    mkdir -p "$log_dir"
    echo "$(date +%Y-%m-%d_%H:%M:%S) ${0##*/} : $1" >> "$log_dir/${0##*/}.log"
}

mkdir -p "$HOME/.hamonikr/theme"

if [ -f "$HOME/.hamonikr/theme/${0##*/}.done" ]; then
    isrun="run"
fi

if [ "x$isrun" != "xrun" ]; then
    # nimf 입력기 기본으로 설정
    if command -v nimf > /dev/null; then
        im-config -n nimf
        echo "$?" > "$HOME/.hamonikr/theme/${0##*/}.done"
        log "Updated nimf as default"
    fi

    # Set conky autostart
    if [ -f "/etc/hamonikr/info" ]; then
        source "/etc/hamonikr/info"
    else
        log "Info file not found."
    fi

    # Execute command based on CONKY value
    if [ "$CONKY" == "TRUE" ]; then
        log "Conky autostart is enabled. Set autostart..."
        
        if [ -f "/usr/share/conky-manager2/themepacks/default-themes-2.1.cmtp.7z" ]; then
            7z x /usr/share/conky-manager2/themepacks/default-themes-2.1.cmtp.7z -o$HOME
            cat <<'EOF' > "$HOME/.conky/conky-startup.sh"
#!/bin/sh

if [ "$DESKTOP_SESSION" = "cinnamon" ]; then 
   sleep 20s
   killall conky
   cd "$HOME/.conky/hamonikr"
   conky -c "$HOME/.conky/hamonikr/hamonikr-info" &
   exit 0
fi
EOF
            chmod +x "$HOME/.conky/conky-startup.sh"
            bash /usr/bin/conkytoggle.sh

        else
            log "Can not found conky theme pack..."
        fi
    else
        log "Conky autostart is disabled. (CONKY = $CONKY)"
    fi

fi
