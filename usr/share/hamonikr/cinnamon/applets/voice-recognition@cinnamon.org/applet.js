/*
 *    Cinnamon 음성 인식 애플릿
 *    음성을 텍스트로 변환하여 클립보드에 복사
 *    Copyright (C) 2024  HamoniKR
 */

const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Settings = imports.ui.settings;

const UUID = "voice-recognition@cinnamon.org";

// 다국어 지원 설정
Gettext.bindtextdomain(UUID, "/usr/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function VoiceRecognitionApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

VoiceRecognitionApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            // 기본 설정값
            this.api_url = "https://api.hamonize.com/whisper/inference";
            this.max_recording_time = 30;
            this.temp_dir = GLib.get_tmp_dir();

            // gsettings 초기화
            this.keybindingsSettings = new Gio.Settings({ schema: 'org.cinnamon.desktop.keybindings' });

            // 설정 초기화
            this.settings = new Settings.AppletSettings(this, UUID, instance_id);
            this._bindSettings();
            
            // 사용자 설정 적용
            if (this.whisperServerUrl) {
                this.api_url = this.whisperServerUrl;
            }
            
            // 마이크 장치 초기화
            this.microphoneDevice = null;
            
            // 애플릿 아이콘 설정 (Applet.Applet 방식)
            this._applet_icon = new St.Icon({
                icon_name: "audio-input-microphone",
                icon_type: St.IconType.SYMBOLIC,
                icon_size: 16
            });
            this.actor.add(this._applet_icon);
            this.set_applet_tooltip(_("Voice Recognition") + " - " + _("Shortcut: ") + "<Primary><Alt>v");

            // 상태 변수
            this.isRecording = false;
            this.recordingProcess = null;
            this.recordingTimeoutId = null;
            this.audioFile = null;
            this.globalKeyBinding = null;
            
            // 메뉴 생성
            this._createMenu(orientation);

            // 필요한 패키지 확인
            this._checkDependencies();

            // 단축키 토글 파일 모니터링 시작
            this._setupToggleFileMonitor();

        } catch (e) {
            global.logError("Voice Recognition Applet Error: " + e);
        }
    },

    _createMenu: function(orientation) {
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // 음성 인식 시작/중지
        this.toggleItem = new PopupMenu.PopupMenuItem(_("Start Voice Recognition"));
        this.toggleItem.connect('activate', Lang.bind(this, this._toggleRecording));
        this.menu.addMenuItem(this.toggleItem);

        // 구분선
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 클립보드 확인
        this.clipboardItem = new PopupMenu.PopupMenuItem(_("Check Clipboard"));
        this.clipboardItem.connect('activate', Lang.bind(this, this._checkClipboard));
        this.menu.addMenuItem(this.clipboardItem);

        // 마지막 텍스트 복사
        this.lastTextItem = new PopupMenu.PopupMenuItem(_("Copy Last Text Again"));
        this.lastTextItem.connect('activate', Lang.bind(this, this._copyLastText));
        this.menu.addMenuItem(this.lastTextItem);

        // 구분선
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 마이크 장치 다시 감지
        this.detectMicItem = new PopupMenu.PopupMenuItem(_("Re-detect Microphone Device"));
        this.detectMicItem.connect('activate', Lang.bind(this, this._detectMicrophoneDevice));
        this.menu.addMenuItem(this.detectMicItem);

        // 구분선
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 구분선
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 상태 표시
        this.statusItem = new PopupMenu.PopupMenuItem("", { reactive: false });
        this.menu.addMenuItem(this.statusItem);
        this._updateStatus(_("Waiting"));

        // 구분선
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 설정 정보
        this.settingsItem = new PopupMenu.PopupMenuItem("", { reactive: false });
        this.settingsItem.actor.add_style_class_name('popup-inactive-menu-item');
        this.menu.addMenuItem(this.settingsItem);
        this._updateShortcutDisplay();
        
        // 메뉴 초기화 완료 후 마이크 장치 감지 실행
        this._detectMicrophoneDevice();
    },

    _detectMicrophoneDevice: function() {
        try {
            let [success, output] = GLib.spawn_command_line_sync("/usr/bin/arecord -l");
            if (success && output) {
                // Uint8Array를 안전하게 문자열로 변환
                let outputText = "";
                if (output instanceof Uint8Array) {
                    outputText = new TextDecoder('utf-8').decode(output);
                } else {
                    outputText = output.toString();
                }
                let lines = outputText.split('\n');
                let devices = [];
                
                for (let line of lines) {
                    // "카드 X: ... , Y 장치: ..." 또는 "card X: ... , device Y: ..." 패턴 찾기
                    let match = line.match(/(\d+)\s*(카드|card):\s*([^,]+),\s*(\d+)\s*(장치|device):\s*([^\[]+)/i);
                    if (match) {
                        let cardId = match[1];
                        let cardName = match[3].trim();
                        let deviceId = match[4];
                        let deviceName = match[6].trim();
                        
                        devices.push({
                            card: cardId,
                            device: deviceId,
                            cardName: cardName,
                            deviceName: deviceName,
                            hwDevice: "hw:" + cardId + "," + deviceId
                        });
                        
                        global.log("Voice Recognition: Found audio device - Card " + cardId + 
                                  " (" + cardName + "), Device " + deviceId + " (" + deviceName + ")");
                    }
                }
                
                // 마이크 장치 우선순위 결정
                this.microphoneDevice = this._selectBestMicrophone(devices);
                
                if (this.microphoneDevice) {
                    global.log("Voice Recognition: Selected microphone - " + 
                              this.microphoneDevice.cardName + " (" + this.microphoneDevice.hwDevice + ")");
                    this._updateStatus(_("대기 중 - ") + this.microphoneDevice.cardName);
                } else {
                    global.log("Voice Recognition: No suitable microphone found, using default");
                    this._updateStatus(_("대기 중 - 기본 마이크"));
                }
            } else {
                global.log("Voice Recognition: Failed to detect audio devices");
                this._updateStatus(_("대기 중 - 기본 마이크"));
            }
        } catch (e) {
            global.logError("Voice Recognition: Microphone detection error: " + e);
            this._updateStatus(_("대기 중 - 기본 마이크"));
        }
    },

    _selectBestMicrophone: function(devices) {
        if (devices.length === 0) return null;
        
        // 우선순위: USB 웹캠 > 내장 마이크 > 기타
        let priorities = [
            { pattern: /webcam|usb/i, score: 100 },
            { pattern: /analog/i, score: 50 },
            { pattern: /digital/i, score: 40 },
            { pattern: /alt/i, score: 10 }
        ];
        
        let workingDevices = [];
        
        // 각 장치가 실제로 작동하는지 테스트
        for (let device of devices) {
            if (this._testMicrophoneDevice(device)) {
                let score = 0;
                let deviceText = (device.cardName + " " + device.deviceName).toLowerCase();
                
                for (let priority of priorities) {
                    if (priority.pattern.test(deviceText)) {
                        score = priority.score;
                        break;
                    }
                }
                
                // 기본 점수 (모든 장치에 적용)
                if (score === 0) score = 1;
                
                device.score = score;
                workingDevices.push(device);
                global.log("Voice Recognition: Device " + device.hwDevice + " is working (score: " + score + ")");
            } else {
                global.log("Voice Recognition: Device " + device.hwDevice + " failed test");
            }
        }
        
        // 점수가 가장 높은 장치 선택
        if (workingDevices.length === 0) return null;
        
        workingDevices.sort((a, b) => b.score - a.score);
        return workingDevices[0];
    },

    _testMicrophoneDevice: function(device) {
        try {
            // 짧은 테스트 녹음 (1초)
            let testFile = this.temp_dir + "/mic_test_" + Date.now() + ".wav";
            let testCmd = "timeout 2 /usr/bin/arecord -D " + device.hwDevice + 
                         " -f S16_LE -r 16000 -c 2 -d 1 -q " + testFile + " 2>/dev/null";
            
            let [success, output] = GLib.spawn_command_line_sync(testCmd);
            
            // 테스트 파일 정리
            try {
                let file = Gio.File.new_for_path(testFile);
                if (file.query_exists(null)) {
                    file.delete(null);
                }
            } catch (e) {
                // 파일 삭제 실패는 무시
            }
            
            return success;
        } catch (e) {
            global.log("Voice Recognition: Test failed for device " + device.hwDevice + ": " + e);
            return false;
        }
    },

    _checkDependencies: function() {
        let dependencies = ['/usr/bin/arecord', '/usr/bin/xclip'];
        let optionalDeps = ['/usr/bin/xdotool', '/usr/bin/wmctrl'];
        let missing = [];
        let missingOptional = [];
        
        // 필수 의존성 체크
        for (let dep of dependencies) {
            try {
                let file = Gio.File.new_for_path(dep);
                if (!file.query_exists(null)) {
                    missing.push(dep.split('/').pop());
                }
            } catch (e) {
                missing.push(dep.split('/').pop());
            }
        }
        
        // 선택적 의존성 체크 (자동 입력용)
        for (let dep of optionalDeps) {
            try {
                let file = Gio.File.new_for_path(dep);
                if (!file.query_exists(null)) {
                    missingOptional.push(dep.split('/').pop());
                }
            } catch (e) {
                missingOptional.push(dep.split('/').pop());
            }
        }
        
        if (missing.length > 0) {
            this._showNotification(_("Missing Dependencies"), 
                "다음 패키지를 설치해주세요: " + missing.join(', ') + 
                "\nsudo apt install alsa-utils xclip");
            this._updateStatus("의존성 누락: " + missing.join(', '));
        } else if (missingOptional.length > 0 && this.settings.getValue("output-method") === "auto-type") {
            global.log("Voice Recognition: Optional dependencies missing for auto-type: " + missingOptional.join(', '));
            global.log("Install with: sudo apt install " + missingOptional.join(' '));
        }
    },

    _updateStatus: function(status) {
        this.statusItem.label.set_text(status);
    },

    _toggleRecording: function() {
        if (this.isRecording) {
            this._stopRecording();
        } else {
            this._startRecording();
        }
    },

    _startRecording: function() {
        if (this.isRecording) return;

        try {
            // 음성 인식 시작 전 현재 활성 창 저장
            if (this.settings.getValue("output-method") === "auto-type") {
                this._saveActiveWindow();
            }
            
            this.isRecording = true;
            this._updateIcon();
            this._updateStatus(_("Recording..."));
            this.toggleItem.label.set_text(_("Stop Voice Recognition"));
            
            // 임시 오디오 파일 생성
            this.audioFile = this.temp_dir + "/voice_recording_" + Date.now() + ".wav";
            
            // arecord 명령으로 녹음 시작 (감지된 마이크 사용, 스테레오로 녹음)
            let recordCmd = [
                "/usr/bin/arecord",
                "-f", "S16_LE",
                "-r", "16000",
                "-c", "2",  // 스테레오로 녹음 (호환성 향상)
                "-d", this.max_recording_time.toString(),
                "-q"  // quiet 모드
            ];
            
            // 감지된 마이크 장치가 있으면 사용
            if (this.microphoneDevice) {
                recordCmd.push("-D", this.microphoneDevice.hwDevice);
                global.log("Voice Recognition: Using microphone device: " + this.microphoneDevice.hwDevice);
            } else {
                global.log("Voice Recognition: Using default microphone device");
            }
            
            recordCmd.push(this.audioFile);
            
            // 녹음 프로세스 시작
            let [success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
                null, // working directory
                recordCmd,
                null, // envp
                GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null // child_setup
            );
            
            if (success) {
                this.recordingProcess = pid;
                this._showNotification("음성 인식", "Recording started. (Max " + this.max_recording_time + " seconds)");
                global.log("Voice Recognition: Recording started with PID " + pid);
                
                // stderr 스트림 모니터링 (에러 감지용)
                if (stderr !== -1) {
                    let stderrStream = new Gio.UnixInputStream({ fd: stderr });
                    let stderrDataStream = new Gio.DataInputStream({ base_stream: stderrStream });
                    
                    // 에러 메시지 읽기 (비동기)
                    this._readStderrAsync(stderrDataStream);
                }
                
                // 프로세스 완료 감지
                GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, Lang.bind(this, this._onRecordingFinished));
                
                // 자동 중지 타이머 (백업용)
                this.recordingTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 
                    this.max_recording_time + 1, Lang.bind(this, function() {
                        if (this.isRecording) {
                            global.log("Voice Recognition: Auto-stopping recording due to timeout");
                            this._stopRecording();
                        }
                        return false;
                    }));
            } else {
                throw new Error("녹음 프로세스 시작 실패");
            }
            
        } catch (e) {
            global.logError("Recording start error: " + e);
            this._showNotification(_("Error"), _("Failed to start recording: ") + e.message);
            this._resetRecordingState();
        }
    },

    _stopRecording: function() {
        if (!this.isRecording) return;

        try {
            // 녹음 프로세스 중지
            if (this.recordingProcess) {
                try {
                    GLib.spawn_command_line_sync("kill " + this.recordingProcess);
                } catch (e) {
                    // 프로세스가 이미 종료된 경우 무시
                }
                this.recordingProcess = null;
            }
            
            // 타이머 정리
            if (this.recordingTimeoutId) {
                GLib.source_remove(this.recordingTimeoutId);
                this.recordingTimeoutId = null;
            }
            
            this._updateStatus(_("Converting..."));
            this._showNotification("음성 인식", "Recording stopped. Converting to text...");
            
            // 잠시 후 변환 시작 (녹음 파일이 완전히 저장될 때까지 대기)
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, Lang.bind(this, function() {
                this._processAudio();
                return false;
            }));
            
        } catch (e) {
            global.logError("Recording stop error: " + e);
            this._showNotification(_("Error"), _("Failed to stop recording: ") + e.message);
            this._resetRecordingState();
        }
    },

    _readStderrAsync: function(dataStream) {
        if (!dataStream) {
            global.log("Voice Recognition: stderr stream is null");
            return;
        }
        
        try {
            dataStream.read_line_async(GLib.PRIORITY_DEFAULT, null, Lang.bind(this, function(stream, result) {
                try {
                    if (!stream || !result) {
                        global.log("Voice Recognition: stderr read - invalid stream or result");
                        return;
                    }
                    
                    let [line, length] = stream.read_line_finish(result);
                    if (line !== null) {
                        let errorMsg = "";
                        // 안전한 문자열 변환
                        if (line instanceof Uint8Array) {
                            errorMsg = new TextDecoder('utf-8').decode(line);
                        } else {
                            errorMsg = line.toString();
                        }
                        
                        global.log("Voice Recognition arecord stderr: " + errorMsg);
                        
                        // 치명적 에러 감지
                        if (errorMsg.includes("No such file") || 
                            errorMsg.includes("Permission denied") ||
                            errorMsg.includes("Device or resource busy") ||
                            errorMsg.includes("Invalid argument") ||
                            errorMsg.includes("No such device")) {
                            this._showNotification(_("Recording Error"), _("Microphone access failed: ") + errorMsg);
                            this._resetRecordingState();
                            return;
                        }
                        
                        // 다음 라인 읽기 (재귀 호출 제한)
                        if (this.isRecording && this.recordingProcess) {
                            this._readStderrAsync(dataStream);
                        }
                    }
                } catch (e) {
                    global.log("Voice Recognition: stderr read finished or error: " + e);
                    // 스트림이 닫혔거나 프로세스가 종료됨
                }
            }));
        } catch (e) {
            global.log("Voice Recognition: stderr read setup error: " + e);
        }
    },

    _onRecordingFinished: function(pid, status) {
        if (this.isRecording && this.recordingProcess === pid) {
            global.log("Voice Recognition: Recording process finished with status " + status);
            this._updateStatus(_("Converting..."));
            this._showNotification("음성 인식", "Recording completed. Converting to text...");
            
            // 잠시 후 변환 시작
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, Lang.bind(this, function() {
                this._processAudio();
                return false;
            }));
        }
    },

    _processAudio: function() {
        if (!this.audioFile) {
            this._resetRecordingState();
            return;
        }

        try {
            // 파일 존재 확인
            let file = Gio.File.new_for_path(this.audioFile);
            if (!file.query_exists(null)) {
                throw new Error("녹음 파일이 생성되지 않았습니다.");
            }

            // 파일 크기 확인
            let fileInfo = file.query_info("standard::size", Gio.FileQueryInfoFlags.NONE, null);
            let fileSize = fileInfo.get_size();
            
            if (fileSize < 1000) { // 1KB 미만이면 빈 파일로 간주
                throw new Error("녹음된 내용이 없습니다. 마이크를 확인해주세요.");
            }

            // 선택된 엔진에 따라 처리
            let engine = this.recognitionEngine || "whisper-server";
            global.log("Voice Recognition: Using engine: " + engine);
            
            switch (engine) {
                case "whisper-server":
                    this._callWhisperServerAPI();
                    break;
                case "openai-whisper":
                    this._callOpenAIWhisperAPI();
                    break;
                case "google-speech":
                    this._callGoogleSpeechAPI();
                    break;
                case "vosk-offline":
                    this._callVoskOfflineAPI();
                    break;
                case "local-whisper":
                    this._callLocalWhisperAPI();
                    break;
                default:
                    this._callWhisperServerAPI(); // 기본값
            }
            
        } catch (e) {
            global.logError("Audio processing error: " + e);
            this._showNotification(_("Error"), _("Audio processing failed: ") + e.message);
            this._resetRecordingState();
        }
    },

    _callWhisperServerAPI: function() {
        try {
            // curl을 사용하여 API 호출
            let apiUrl = this.whisperServerUrl || this.api_url;
            let curlCmd = [
                "/usr/bin/curl",
                "-X", "POST",
                "-F", "file=@" + this.audioFile,
                apiUrl
            ];
            
            // 비동기로 curl 실행
            let [success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
                null, // working directory
                curlCmd,
                null, // envp
                GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null // child_setup
            );
            
            if (success) {
                global.log("Voice Recognition: API call started with PID " + pid);
                
                // stdout 읽기
                let stdoutStream = new Gio.DataInputStream({
                    base_stream: new Gio.UnixInputStream({fd: stdout})
                });
                
                this._readAPIResponse(stdoutStream, pid);
            } else {
                throw new Error("API 호출 시작 실패");
            }
            
        } catch (e) {
            global.logError("API call error: " + e);
            this._showNotification(_("Error"), _("API call failed: ") + e.message);
            this._resetRecordingState();
        }
    },

    _readAPIResponse: function(dataStream, pid, tempFile) {
        if (!dataStream || !pid) {
            global.log("Voice Recognition: invalid dataStream or pid");
            this._resetRecordingState();
            return;
        }
        
        // 타임아웃 설정 (30초)
        let timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30000, Lang.bind(this, function() {
            global.log("Voice Recognition: API call timeout");
            this._showNotification(_("Error"), _("API response timeout"));
            this._resetRecordingState();
            if (pid > 0) {
                try {
                    GLib.spawn_close_pid(pid);
                } catch (e) {
                    global.log("Voice Recognition: error closing pid: " + e);
                }
            }
            return false;
        }));
        
        try {
            dataStream.read_line_async(GLib.PRIORITY_DEFAULT, null, Lang.bind(this, function(stream, result) {
                try {
                    // 타임아웃 취소
                    if (timeoutId > 0) {
                        GLib.source_remove(timeoutId);
                        timeoutId = 0;
                    }
                    
                    if (!stream || !result) {
                        global.log("Voice Recognition: API response - invalid stream or result");
                        this._resetRecordingState();
                        return;
                    }
                    
                    let [line, length] = stream.read_line_finish(result);
                    
                    if (line !== null) {
                        let responseText = "";
                        // 안전한 문자열 변환
                        if (line instanceof Uint8Array) {
                            responseText = new TextDecoder('utf-8').decode(line);
                        } else {
                            responseText = line.toString();
                        }
                        
                        global.log("Voice Recognition: API Response: " + responseText);
                        
                        // JSON 응답 파싱
                        try {
                            let responseData = JSON.parse(responseText);
                            this._handleAPIResponse(responseData);
                        } catch (parseError) {
                            // JSON이 아닌 경우 텍스트 그대로 사용
                            this._handleAPIResponse({text: responseText.trim()});
                        }
                        
                        // 프로세스 정리
                        if (pid > 0) {
                            try {
                                GLib.spawn_close_pid(pid);
                            } catch (e) {
                                global.log("Voice Recognition: error closing pid: " + e);
                            }
                        }
                        
                        // 임시 파일 정리
                        if (tempFile) {
                            try {
                                let file = Gio.File.new_for_path(tempFile);
                                if (file.query_exists(null)) {
                                    file.delete(null);
                                }
                            } catch (e) {
                                global.log("Voice Recognition: error deleting temp file: " + e);
                            }
                        }
                    } else {
                        // 응답이 없으면 에러 처리
                        this._showNotification(_("Error"), _("No API response received."));
                        this._resetRecordingState();
                        if (pid > 0) {
                            try {
                                GLib.spawn_close_pid(pid);
                            } catch (e) {
                                global.log("Voice Recognition: error closing pid: " + e);
                            }
                        }
                    }
                } catch (e) {
                    global.log("Voice Recognition: API response read error: " + e);
                    this._showNotification(_("Error"), _("API response processing failed: ") + e.message);
                    this._resetRecordingState();
                    if (pid > 0) {
                        try {
                            GLib.spawn_close_pid(pid);
                        } catch (e) {
                            global.log("Voice Recognition: error closing pid: " + e);
                        }
                    }
                }
            }));
        } catch (e) {
            // 타임아웃 취소
            if (timeoutId > 0) {
                GLib.source_remove(timeoutId);
            }
            global.log("Voice Recognition: API response read setup error: " + e);
            this._showNotification(_("Error"), _("API response reading failed: ") + e.message);
            this._resetRecordingState();
        }
    },

    _handleAPIResponse: function(response) {
        try {
            let text = "";
            
            // 응답이 객체인 경우 (JSON 파싱 성공)
            if (typeof response === 'object' && response.text) {
                text = response.text;
            } 
            // 응답이 문자열인 경우 (직접 텍스트)
            else if (typeof response === 'string') {
                text = response;
            }
            // 기타 형식 시도
            else {
                text = String(response);
            }
            
            if (text.trim() === "") {
                throw new Error("음성이 인식되지 않았습니다.");
            }
            
            // 출력 방법에 따라 처리
            this.lastRecognizedText = text.trim();
            
            if (this.settings.getValue("output-method") === "auto-type") {
                // 포커스된 창에 자동 입력
                this._autoTypeText(text.trim());
                // this._showNotification("Voice Recognition Complete", "텍스트가 자동 입력되었습니다:\n" + text.substring(0, 50) + (text.length > 50 ? "..." : ""));
                this._showNotification(_("Voice Recognition Complete"), "");
            } else {
                // 클립보드에 복사 (기본)
                this._copyToClipboard(text.trim());
                // this._showNotification("Voice Recognition Complete", "텍스트가 클립보드에 복사되었습니다:\n" + text.substring(0, 50) + (text.length > 50 ? "..." : ""));
                this._showNotification(_("Voice Recognition Complete"), "텍스트가 클립보드에 복사되었습니다");
            }
            this._updateStatus(_("Complete: ") + text.substring(0, 30) + (text.length > 30 ? "..." : ""));
            
        } catch (e) {
            global.logError("API response error: " + e);
            this._showNotification(_("Error"), _("Voice recognition failed: ") + e.message);
            this._updateStatus(_("Recognition Failed"));
        } finally {
            this._resetRecordingState();
        }
    },

    // OpenAI Whisper API 호출
    _callOpenAIWhisperAPI: function() {
        try {
            if (!this.openaiApiKey) {
                throw new Error("OpenAI API key is not configured");
            }

            let curlCmd = [
                "/usr/bin/curl",
                "-X", "POST",
                "-H", "Authorization: Bearer " + this.openaiApiKey,
                "-H", "Content-Type: multipart/form-data",
                "-F", "file=@" + this.audioFile,
                "-F", "model=whisper-1",
                "-F", "language=ko",
                "https://api.openai.com/v1/audio/transcriptions"
            ];

            this._executeAPICall(curlCmd, "OpenAI Whisper");
            
        } catch (e) {
            global.logError("OpenAI API call error: " + e);
            this._showNotification(_("Error"), _("OpenAI API call failed: ") + e.message);
            this._resetRecordingState();
        }
    },

    // Google Cloud Speech API 호출
    _callGoogleSpeechAPI: function() {
        try {
            if (!this.googleApiKey) {
                throw new Error("Google Cloud API key is not configured");
            }

            // 오디오 파일을 base64로 인코딩
            let [success, audioData] = GLib.file_get_contents(this.audioFile);
            if (!success) {
                throw new Error("Failed to read audio file");
            }

            let base64Audio = GLib.base64_encode(audioData);
            let requestData = {
                "config": {
                    "encoding": "LINEAR16",
                    "sampleRateHertz": 16000,
                    "languageCode": "ko-KR"
                },
                "audio": {
                    "content": base64Audio
                }
            };

            // 임시 JSON 파일 생성
            let jsonFile = this.temp_dir + "/google_request_" + Date.now() + ".json";
            let file = Gio.File.new_for_path(jsonFile);
            let outputStream = file.create(Gio.FileCreateFlags.NONE, null);
            let dataStream = Gio.DataOutputStream.new(outputStream);
            dataStream.put_string(JSON.stringify(requestData), null);
            dataStream.close(null);

            let curlCmd = [
                "/usr/bin/curl",
                "-X", "POST",
                "-H", "Content-Type: application/json",
                "-d", "@" + jsonFile,
                "https://speech.googleapis.com/v1/speech:recognize?key=" + this.googleApiKey
            ];

            this._executeAPICall(curlCmd, "Google Speech", jsonFile);
            
        } catch (e) {
            global.logError("Google Speech API call error: " + e);
            this._showNotification(_("Error"), _("Google Speech API call failed: ") + e.message);
            this._resetRecordingState();
        }
    },

    // Vosk 오프라인 음성인식
    _callVoskOfflineAPI: function() {
        try {
            let modelPath = this.voskModelPath || "/usr/share/vosk-models";
            
            // Python 스크립트로 Vosk 실행
            let pythonScript = `
import json
import wave
import vosk
import sys

model_path = "${modelPath}"
audio_file = "${this.audioFile}"

try:
    model = vosk.Model(model_path)
    rec = vosk.KaldiRecognizer(model, 16000)
    
    wf = wave.open(audio_file, 'rb')
    results = []
    
    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            results.append(json.loads(rec.Result()))
    
    final_result = json.loads(rec.FinalResult())
    if final_result.get('text'):
        results.append(final_result)
    
    full_text = ' '.join([r.get('text', '') for r in results]).strip()
    print(json.dumps({"text": full_text}))
    
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

            let scriptFile = this.temp_dir + "/vosk_script_" + Date.now() + ".py";
            let file = Gio.File.new_for_path(scriptFile);
            let outputStream = file.create(Gio.FileCreateFlags.NONE, null);
            let dataStream = Gio.DataOutputStream.new(outputStream);
            dataStream.put_string(pythonScript, null);
            dataStream.close(null);

            let pythonCmd = ["/usr/bin/python3", scriptFile];
            this._executeAPICall(pythonCmd, "Vosk Offline", scriptFile);
            
        } catch (e) {
            global.logError("Vosk API call error: " + e);
            this._showNotification(_("Error"), _("Vosk API call failed: ") + e.message);
            this._resetRecordingState();
        }
    },

    // Local Whisper 음성인식
    _callLocalWhisperAPI: function() {
        try {
            let whisperCmd = [
                "/usr/bin/python3", "-c",
                `import whisper; model = whisper.load_model('base'); result = model.transcribe('${this.audioFile}'); import json; print(json.dumps({'text': result['text']}))`
            ];

            this._executeAPICall(whisperCmd, "Local Whisper");
            
        } catch (e) {
            global.logError("Local Whisper API call error: " + e);
            this._showNotification(_("Error"), _("Local Whisper API call failed: ") + e.message);
            this._resetRecordingState();
        }
    },

    // 통합 API 호출 실행 함수
    _executeAPICall: function(command, engineName, tempFile) {
        try {
            let [success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
                null, // working directory
                command,
                null, // envp
                GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null // child_setup
            );
            
            if (success) {
                global.log("Voice Recognition: " + engineName + " API call started with PID " + pid);
                
                let stdoutStream = new Gio.DataInputStream({
                    base_stream: new Gio.UnixInputStream({fd: stdout})
                });
                
                this._readAPIResponse(stdoutStream, pid, tempFile);
            } else {
                throw new Error(engineName + " API 호출 시작 실패");
            }
            
        } catch (e) {
            global.logError(engineName + " API call error: " + e);
            this._showNotification(_("Error"), engineName + _(" API call failed: ") + e.message);
            this._resetRecordingState();
            
            // 임시 파일 정리
            if (tempFile) {
                try {
                    let file = Gio.File.new_for_path(tempFile);
                    if (file.query_exists(null)) {
                        file.delete(null);
                    }
                } catch (e) {
                    // 무시
                }
            }
        }
    },

    _copyToClipboard: function(text) {
        if (!text || typeof text !== 'string') {
            global.log("Voice Recognition: Invalid text for clipboard");
            return;
        }
        
        try {
            // xclip을 사용하여 클립보드에 복사
            let [success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
                null, // working directory
                ["/usr/bin/xclip", "-selection", "clipboard"],
                null, // envp
                GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null // child_setup
            );
            
            if (success && stdin !== -1) {
                try {
                    let stdinStream = new Gio.UnixOutputStream({ fd: stdin });
                    let textBytes = new TextEncoder('utf-8').encode(text);
                    stdinStream.write(textBytes, null);
                    stdinStream.close(null);
                    
                    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, Lang.bind(this, function() {
                        // 프로세스 완료 후 정리
                        try {
                            GLib.spawn_close_pid(pid);
                        } catch (e) {
                            global.log("Voice Recognition: Error closing clipboard pid: " + e);
                        }
                    }));
                    
                    global.log("Voice Recognition: Text copied to clipboard");
                } catch (streamError) {
                    global.log("Voice Recognition: Clipboard stream error: " + streamError);
                    if (pid > 0) {
                        try {
                            GLib.spawn_close_pid(pid);
                        } catch (e) {
                            global.log("Voice Recognition: Error closing pid: " + e);
                        }
                    }
                }
            } else {
                global.log("Voice Recognition: Failed to start xclip process");
            }
        } catch (e) {
            global.log("Voice Recognition: Clipboard copy error: " + e);
        }
    },

    _saveActiveWindow: function() {
        try {
            // xdotool로 현재 활성 창 ID 저장
            let [success, output] = GLib.spawn_command_line_sync("/usr/bin/xdotool getactivewindow");
            if (success && output) {
                this.savedWindowId = output.toString().trim();
                global.log("Voice Recognition: Saved active window ID: " + this.savedWindowId);
                
                // 창 제목도 저장 (디버깅용)
                let [titleSuccess, titleOutput] = GLib.spawn_command_line_sync(
                    "/usr/bin/xdotool getwindowname " + this.savedWindowId
                );
                if (titleSuccess && titleOutput) {
                    global.log("Voice Recognition: Active window title: " + titleOutput.toString().trim());
                }
            } else {
                // wmctrl 대체 시도
                let [wmSuccess, wmOutput] = GLib.spawn_command_line_sync("/usr/bin/wmctrl -a :ACTIVE:");
                if (wmSuccess) {
                    global.log("Voice Recognition: Using wmctrl for window management");
                }
            }
        } catch (e) {
            global.log("Voice Recognition: Failed to save active window: " + e);
        }
    },

    _restoreActiveWindow: function() {
        try {
            if (this.savedWindowId) {
                // 저장된 창으로 포커스 복원
                let [success] = GLib.spawn_command_line_sync(
                    "/usr/bin/xdotool windowactivate " + this.savedWindowId
                );
                if (success) {
                    global.log("Voice Recognition: Restored focus to window ID: " + this.savedWindowId);
                    return true;
                }
            }
        } catch (e) {
            global.log("Voice Recognition: Failed to restore window focus: " + e);
        }
        return false;
    },

    _autoTypeText: function(text) {
        try {
            if (!text || typeof text !== 'string') {
                global.log("Voice Recognition: Invalid text for auto-typing");
                return;
            }
            
            // xdotool 사용 가능 여부 확인
            let [xdotoolExists] = GLib.spawn_command_line_sync("/usr/bin/which xdotool");
            if (!xdotoolExists) {
                global.log("Voice Recognition: xdotool not installed, falling back to clipboard");
                this._copyToClipboard(text);
                this._showNotification(_("Auto-type Unavailable"), "xdotool이 설치되지 않았습니다. 클립보드에 복사되었습니다.");
                return;
            }
            
            // 입력 지연 시간 설정
            let delay = this.settings.getValue("auto-input-delay") || 100;
            
            // 저장된 창으로 포커스 복원 후 텍스트 입력
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, Lang.bind(this, function() {
                try {
                    // 창 포커스 복원
                    if (this.savedWindowId) {
                        this._restoreActiveWindow();
                        
                        // 창 활성화 후 추가 대기
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, Lang.bind(this, function() {
                            try {
                                // 텍스트를 안전하게 이스케이프
                                let escapedText = text.replace(/'/g, "'\\''");
                                
                                // xdotool type 명령으로 텍스트 입력
                                let typeCommand = "/usr/bin/xdotool type --delay " + delay + " '" + escapedText + "'";
                                let [typeSuccess] = GLib.spawn_command_line_sync(typeCommand);
                                
                                if (typeSuccess) {
                                    global.log("Voice Recognition: Text auto-typed successfully");
                                } else {
                                    throw new Error("xdotool type command failed");
                                }
                            } catch (e) {
                                global.log("Voice Recognition: Auto-type error: " + e);
                                this._copyToClipboard(text);
                                this._showNotification(_("Auto-type Failed"), "텍스트가 대신 클립보드에 복사되었습니다.");
                            }
                            return GLib.SOURCE_REMOVE;
                        }));
                    } else {
                        // 저장된 창 ID가 없으면 현재 창에 입력
                        let escapedText = text.replace(/'/g, "'\\''");
                        let typeCommand = "/usr/bin/xdotool type --delay " + delay + " '" + escapedText + "'";
                        GLib.spawn_command_line_sync(typeCommand);
                        global.log("Voice Recognition: Text typed to current window");
                    }
                } catch (e) {
                    global.log("Voice Recognition: Auto-type process error: " + e);
                    this._copyToClipboard(text);
                    this._showNotification(_("Auto-type Failed"), "텍스트가 대신 클립보드에 복사되었습니다.");
                }
                return GLib.SOURCE_REMOVE;
            }));
            
        } catch (e) {
            global.log("Voice Recognition: Auto-type setup error: " + e);
            this._copyToClipboard(text);
        }
    },

    _copyLastText: function() {
        if (this.lastRecognizedText) {
            if (this.settings.getValue("output-method") === "auto-type") {
                this._autoTypeText(this.lastRecognizedText);
                this._showNotification(_("Auto-type Complete"), "마지막 텍스트를 다시 입력했습니다:\n" + this.lastRecognizedText);
            } else {
                this._copyToClipboard(this.lastRecognizedText);
                this._showNotification(_("Copy Complete"), "마지막 텍스트를 다시 복사했습니다:\n" + this.lastRecognizedText);
            }
        } else {
            this._showNotification(_("Notification"), _("No text to copy."));
        }
    },

    _checkClipboard: function() {
        try {
            let [success, output] = GLib.spawn_command_line_sync("/usr/bin/xclip -selection clipboard -o");
            if (success) {
                let clipboardText = output.toString();
                if (clipboardText.trim() === "") {
                    this._showNotification(_("Clipboard"), _("Clipboard is empty."));
                } else {
                    this._showNotification(_("Clipboard Content"), clipboardText.substring(0, 100) + (clipboardText.length > 100 ? "..." : ""));
                }
            } else {
                this._showNotification(_("Error"), _("Clipboard reading failed"));
            }
        } catch (e) {
            this._showNotification(_("Error"), _("Clipboard check failed: ") + e.message);
        }
    },

    _resetRecordingState: function() {
        try {
            // 녹음 프로세스 정리
            if (this.recordingProcess) {
                try {
                    GLib.spawn_close_pid(this.recordingProcess);
                    global.log("Voice Recognition: Process " + this.recordingProcess + " cleaned up");
                } catch (e) {
                    global.log("Voice Recognition: Error cleaning up process: " + e);
                }
            }
            
            // 타임아웃 정리
            if (this.recordingTimeoutId) {
                try {
                    GLib.source_remove(this.recordingTimeoutId);
                } catch (e) {
                    global.log("Voice Recognition: Error removing timeout: " + e);
                }
                this.recordingTimeoutId = null;
            }
            
            // 임시 파일 정리
            if (this.audioFile) {
                try {
                    let file = Gio.File.new_for_path(this.audioFile);
                    if (file.query_exists(null)) {
                        file.delete(null);
                        global.log("Voice Recognition: Temp file deleted: " + this.audioFile);
                    }
                } catch (e) {
                    global.log("Voice Recognition: Error deleting temp file: " + e);
                }
                this.audioFile = null;
            }
            
            // 상태 초기화
            this.isRecording = false;
            this.recordingProcess = null;
            
            // UI 업데이트 (안전하게)
            try {
                this._updateIcon();
            } catch (e) {
                global.log("Voice Recognition: Error updating icon: " + e);
            }
            
            try {
                if (this.toggleItem && this.toggleItem.label) {
                    this.toggleItem.label.set_text(_("Start Voice Recognition"));
                }
            } catch (e) {
                global.log("Voice Recognition: Error updating toggle item: " + e);
            }
            
            try {
                if (this.statusItem && this.statusItem.label) {
                    let currentText = this.statusItem.label.get_text();
                    if (currentText.includes("중") || currentText.includes("변환")) {
                        this._updateStatus(_("Waiting"));
                    }
                }
            } catch (e) {
                global.log("Voice Recognition: Error updating status: " + e);
            }
            
        } catch (e) {
            global.log("Voice Recognition: Error in _resetRecordingState: " + e);
        }
    },

    _updateIcon: function() {
        if (this.isRecording) {
            this._applet_icon.set_icon_name("media-record");
        } else {
            this._applet_icon.set_icon_name("audio-input-microphone");
        }
    },

    _showNotification: function(title, message) {
        if (!title || !message) {
            global.log("Voice Recognition: Invalid notification parameters");
            return;
        }
        
        try {
            // 특수 문자 이스케이프 처리
            let safeTitle = title.replace(/'/g, "\\'").replace(/"/g, '\\"');
            let safeMessage = message.replace(/'/g, "\\'").replace(/"/g, '\\"');
            
            let command = ["notify-send", safeTitle, safeMessage, "--icon=audio-input-microphone", "--expire-time=2000"];
            
            let [success] = GLib.spawn_async(
                null, // working directory
                command,
                null, // envp
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null // child_setup
            );
            
            if (!success) {
                global.log("Voice Recognition: Failed to show notification");
            }
        } catch (e) {
            global.log("Voice Recognition: Notification error: " + e);
        }
    },

    on_applet_clicked: function(event) {
        this._toggleRecording();
    },

    on_applet_right_clicked: function(event) {
        this.menu.toggle();
    },

    // Public 메서드 - 외부에서 호출 가능
    toggleRecording: function() {
        this._toggleRecording();
    },

    // 단축키 토글 파일 모니터링 설정
    _setupToggleFileMonitor: function() {
        try {
            this.toggleFilePath = "/tmp/voice-recognition-toggle";
            
            // 기존 파일 삭제
            try {
                let file = Gio.File.new_for_path(this.toggleFilePath);
                if (file.query_exists(null)) {
                    file.delete(null);
                }
            } catch (e) {
                // 파일이 없으면 무시
            }
            
            // 파일 모니터링 시작
            this._startToggleFileMonitor();
            
        } catch (e) {
            global.log("Voice Recognition: Error setting up toggle file monitor: " + e);
        }
    },

    // 토글 파일 모니터링 시작
    _startToggleFileMonitor: function() {
        try {
            // 주기적으로 파일 체크 (1초마다)
            this.toggleMonitorId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, Lang.bind(this, function() {
                try {
                    let file = Gio.File.new_for_path(this.toggleFilePath);
                    if (file.query_exists(null)) {
                        // 파일이 존재하면 토글 실행
                        global.log("Voice Recognition: Toggle file detected, executing toggle");
                        this._toggleRecording();
                        
                        // 파일 삭제
                        try {
                            file.delete(null);
                        } catch (e) {
                            global.log("Voice Recognition: Error deleting toggle file: " + e);
                        }
                    }
                } catch (e) {
                    global.log("Voice Recognition: Error checking toggle file: " + e);
                }
                
                return true; // 계속 모니터링
            }));
            
            global.log("Voice Recognition: Toggle file monitor started");
            
        } catch (e) {
            global.log("Voice Recognition: Error starting toggle file monitor: " + e);
        }
    },

    // 설정 바인딩
    _bindSettings: function() {
        try {
            // 엔진 선택 설정
            this.settings.bind("recognition-engine", "recognitionEngine", this._onSettingsChanged);
            
            // API 설정들
            this.settings.bind("whisper-server-url", "whisperServerUrl", this._onSettingsChanged);
            this.settings.bind("openai-api-key", "openaiApiKey", this._onSettingsChanged);
            this.settings.bind("google-api-key", "googleApiKey", this._onSettingsChanged);
            this.settings.bind("vosk-model-path", "voskModelPath", this._onSettingsChanged);
            
            // 단축키 설정
            this.settings.bind("toggle-shortcut", "toggleShortcut", this._onShortcutChanged);
            
            // 초기 단축키 설정
            this._setupGlobalShortcut();
            
        } catch (e) {
            global.log("Voice Recognition: Error binding settings: " + e);
        }
    },

    // 설정 변경 처리
    _onSettingsChanged: function() {
        try {
            // 툴팁 업데이트
            this._updateTooltip();
            
            // API URL 업데이트
            if (this.whisperServerUrl) {
                this.api_url = this.whisperServerUrl;
                global.log("Voice Recognition: API URL updated to: " + this.api_url);
            }
            
        } catch (e) {
            global.log("Voice Recognition: Error handling settings change: " + e);
        }
    },

    // 단축키 설정 변경 처리
    _onShortcutChanged: function() {
        try {
            this._setupGlobalShortcut();
            this._updateTooltip();
            this._updateShortcutDisplay();
        } catch (e) {
            global.log("Voice Recognition: Error handling shortcut change: " + e);
        }
    },



    // 글로벌 단축키 설정 (gsettings 방식)
    _setupGlobalShortcut: function() {
        try {
            global.log("Voice Recognition: Setting up global shortcut...");
            global.log("Voice Recognition: toggleShortcut = " + this.toggleShortcut);

            // 기존 단축키 제거
            this._removeGlobalShortcut();

            // 새 단축키 설정 (항상 활성화)
            if (this.toggleShortcut) {
                let shortcut = this.toggleShortcut.replace(/::/g, "");
                global.log("Voice Recognition: Setting up shortcut: " + shortcut);
                
                this._addGlobalShortcut(shortcut);
            } else {
                global.log("Voice Recognition: No shortcut configured");
            }
        } catch (e) {
            global.log("Voice Recognition: Error in _setupGlobalShortcut: " + e);
        }
    },

    // gsettings를 통한 단축키 추가
    _addGlobalShortcut: function(shortcut) {
        try {
            // Voice Recognition 전용 custom slot 찾기
            let customKeyId = this._findVoiceRecognitionSlot();
            let customKeyPath = "/org/cinnamon/desktop/keybindings/custom-keybindings/" + customKeyId + "/";
            
            global.log("Voice Recognition: Using key ID: " + customKeyId);
            
            // 커스텀 키바인딩 목록 가져오기
            let customKeys = this.keybindingsSettings.get_strv('custom-list');
            
            // 목록에 추가 (중복 확인)
            if (customKeys.indexOf(customKeyId) === -1) {
                customKeys.push(customKeyId);
                this.keybindingsSettings.set_strv('custom-list', customKeys);
                global.log("Voice Recognition: Added to custom-list: " + customKeyId);
            }
            
            // 개별 키바인딩 설정 (gsettings 명령어 방식)
            let commands = [
                "gsettings set org.cinnamon.desktop.keybindings.custom-keybinding:" + customKeyPath + " binding \"['" + shortcut + "']\"",
                "gsettings set org.cinnamon.desktop.keybindings.custom-keybinding:" + customKeyPath + " command '/usr/local/bin/voice-recognition-toggle.sh'",
                "gsettings set org.cinnamon.desktop.keybindings.custom-keybinding:" + customKeyPath + " name 'Voice Recognition Toggle'"
            ];
            
            // 각 명령어 실행
            for (let cmd of commands) {
                try {
                    let [success, output] = GLib.spawn_command_line_sync(cmd);
                    if (!success) {
                        global.log("Voice Recognition: Failed to execute: " + cmd);
                    }
                } catch (e) {
                    global.log("Voice Recognition: Error executing command: " + cmd + " - " + e);
                }
            }
            
            this.globalKeyBinding = customKeyId;
            this.currentShortcut = shortcut;
            global.log("Voice Recognition: Global shortcut registered successfully: " + shortcut);
            
        } catch (e) {
            global.log("Voice Recognition: Error adding global shortcut: " + e);
        }
    },

    // Voice Recognition 전용 슬롯 찾기
    _findVoiceRecognitionSlot: function() {
        try {
            let customKeys = this.keybindingsSettings.get_strv('custom-list');
            
            // 기존에 Voice Recognition이 사용하던 슬롯이 있는지 확인
            for (let keyId of customKeys) {
                try {
                    let customKeyPath = "/org/cinnamon/desktop/keybindings/custom-keybindings/" + keyId + "/";
                    let keySettings = new Gio.Settings({ 
                        schema: 'org.cinnamon.desktop.keybindings.custom-keybinding',
                        path: customKeyPath
                    });
                    
                    let name = keySettings.get_string('name');
                    if (name === 'Voice Recognition Toggle') {
                        global.log("Voice Recognition: Reusing existing slot: " + keyId);
                        return keyId;
                    }
                } catch (e) {
                    // 해당 슬롯에 접근할 수 없으면 무시
                    continue;
                }
            }
            
            // 새로운 슬롯 찾기 (0부터 시작)
            for (let i = 0; i < 100; i++) {
                let keyId = "custom" + i;
                if (customKeys.indexOf(keyId) === -1) {
                    global.log("Voice Recognition: Using new slot: " + keyId);
                    return keyId;
                }
            }
            
            // 100개 이상이면 타임스탬프 사용
            return "custom" + Date.now();
            
        } catch (e) {
            global.log("Voice Recognition: Error finding slot: " + e);
            return "custom" + Date.now();
        }
    },

    // 기존 단축키 제거
    _removeGlobalShortcut: function() {
        try {
            if (this.globalKeyBinding) {
                global.log("Voice Recognition: Removing global shortcut: " + this.globalKeyBinding);
                
                let customKeyPath = "/org/cinnamon/desktop/keybindings/custom-keybindings/" + this.globalKeyBinding + "/";
                
                // gsettings 명령어로 키바인딩 제거
                let commands = [
                    "gsettings set org.cinnamon.desktop.keybindings.custom-keybinding:" + customKeyPath + " binding \"[]\"",
                    "gsettings set org.cinnamon.desktop.keybindings.custom-keybinding:" + customKeyPath + " command ''",
                    "gsettings set org.cinnamon.desktop.keybindings.custom-keybinding:" + customKeyPath + " name ''"
                ];
                
                // 각 명령어 실행
                for (let cmd of commands) {
                    try {
                        let [success, output] = GLib.spawn_command_line_sync(cmd);
                        if (!success) {
                            global.log("Voice Recognition: Failed to execute: " + cmd);
                        }
                    } catch (e) {
                        global.log("Voice Recognition: Error executing command: " + cmd + " - " + e);
                    }
                }
                
                // 커스텀 키 목록에서 제거
                let customKeys = this.keybindingsSettings.get_strv('custom-list');
                let index = customKeys.indexOf(this.globalKeyBinding);
                
                if (index !== -1) {
                    customKeys.splice(index, 1);
                    this.keybindingsSettings.set_strv('custom-list', customKeys);
                    global.log("Voice Recognition: Removed from custom-list: " + this.globalKeyBinding);
                }
                
                this.globalKeyBinding = null;
                this.currentShortcut = null;
            }
        } catch (e) {
            global.log("Voice Recognition: Error removing global shortcut: " + e);
        }
    },



    // 툴팁 업데이트
    _updateTooltip: function() {
        try {
            let tooltip = _("Voice Recognition");
            if (this.toggleShortcut) {
                tooltip += " - " + _("Shortcut: ") + this.toggleShortcut;
            }
            this.set_applet_tooltip(tooltip);
        } catch (e) {
            global.log("Voice Recognition: Error updating tooltip: " + e);
        }
    },

    // 단축키 표시 업데이트
    _updateShortcutDisplay: function() {
        try {
            if (this.settingsItem) {
                let shortcutText = _("Shortcut: ");
                if (this.toggleShortcut) {
                    shortcutText += this.toggleShortcut;
                } else {
                    shortcutText += "<Primary><Alt>v";
                }
                this.settingsItem.label.set_text(shortcutText);
            }
        } catch (e) {
            global.log("Voice Recognition: Error updating shortcut display: " + e);
        }
    },

    on_applet_removed_from_panel: function() {
        try {
            global.log("Voice Recognition: Applet being removed, cleaning up...");
            
            // 진행 중인 녹음 중지
            if (this.isRecording) {
                this._stopRecording();
            }
            
            // 글로벌 단축키 해제
            this._removeGlobalShortcut();
            
            // 토글 파일 모니터링 정리
            if (this.toggleMonitorId) {
                GLib.source_remove(this.toggleMonitorId);
                this.toggleMonitorId = null;
            }
            
            // 토글 파일 삭제
            if (this.toggleFilePath) {
                try {
                    let file = Gio.File.new_for_path(this.toggleFilePath);
                    if (file.query_exists(null)) {
                        file.delete(null);
                    }
                } catch (e) {
                    // 파일 삭제 실패는 무시
                }
            }
            
            // 리소스 정리 완료
            
            // 모든 리소스 정리
            this._resetRecordingState();
            
            // 메뉴 정리
            if (this.menuManager && this.menu) {
                try {
                    this.menuManager.removeMenu(this.menu);
                } catch (e) {
                    global.log("Voice Recognition: Error removing menu: " + e);
                }
            }
            
            global.log("Voice Recognition: Cleanup completed");
        } catch (e) {
            global.log("Voice Recognition: Error during cleanup: " + e);
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new VoiceRecognitionApplet(orientation, panel_height, instance_id);
    return myApplet;
} 