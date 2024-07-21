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
    exit
fi

if [ ! -d "/home/${USER}/.hamonikr/" ]; then
    mkdir -p /home/${USER}/.hamonikr/
fi

if [ ! -d "/home/${USER}/.config/autostart/" ]; then
    mkdir -p /home/${USER}/.config/autostart/
fi

log() {
    # stdout
    echo "$1"
    # write to logfile
    mkdir -p $HOME/.hamonikr/log
    echo "$(date +%Y-%m-%d_%H:%M_%S) ${0##*/} : $1" >> $HOME/.hamonikr/log/${0##*/}.log
}

mkdir -p $HOME/.hamonikr/theme

if [ -f $HOME/.hamonikr/theme/${0##*/}.done ]; then
    isrun="run"
fi

if [ "x$isrun" != "xrun" ]; then
    # nimf 입력기 기본으로 설정
    if command -v nimf > /dev/null; then
        im-config -n nimf
        echo "$?" > $HOME/.hamonikr/theme/${0##*/}.done
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
        sed -i -r s/Hidden=.*/Hidden=false/ "$HOME"/.config/autostart/conky.desktop
    else
        log "Conky autostart is disabled. Disable autostart..."
        sed -i -r s/Hidden=.*/Hidden=true/ "$HOME"/.config/autostart/conky.desktop    
    fi
    
fi

