#!/usr/bin/python3

import os
import subprocess
import sys
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib

import gettext
import locale
import threading
import re
import argparse

# i18n
APP = 'video2gif'
# 시스템 로케일 디렉토리 적용 시
# LOCALE_DIR = "/usr/share/locale"

# 이 프로그램은 현재 스크립트의 디렉토리를 기준으로 번역 파일들의 경로를 설정.
current_dir = os.path.dirname(os.path.abspath(__file__))
LOCALE_DIR = os.path.join(current_dir, 'locale')
print(LOCALE_DIR)
locale.bindtextdomain(APP, LOCALE_DIR)
gettext.bindtextdomain(APP, LOCALE_DIR)
gettext.textdomain(APP)
_ = gettext.gettext

class Video2GIFConverter:
    def __init__(self, video_file=None):
        self.builder = Gtk.Builder()
        self.builder.set_translation_domain(APP)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        ui_path = os.path.join(current_dir, "video2gif.ui")
        self.builder.add_from_file(ui_path)
        self.builder.connect_signals({
            "on_cancel_btn_clicked": self.on_cancel_btn_clicked,
            "on_window_destroy": self.on_window_destroy,
            "on_file_set": self.on_file_set, 
            "on_convert_button_clicked": self.on_convert_button_clicked,
        })
        # Get the palette checkbox and set it active
        palette_checkbox = self.builder.get_object("use_pallete")
        palette_checkbox.set_active(True)        
        self.window = self.builder.get_object("convert_dialog")

        self.window.show_all()

        # If an initial file is provided, set it in the file chooser button
        if video_file and self.is_supported_file_type(video_file):
            self.video_file = video_file
            file_chooser_button = self.builder.get_object("file_chooser_button")
            if file_chooser_button:  # Ensure the object is not None
                file_chooser_button.set_filename(self.video_file)
            else:
                print("file_chooser_button not found in the UI definition.")
                sys.exit(1)

        # 프로그레스 바 위젯 숨기기
        self.progress_bar = self.builder.get_object("progress_bar")
        self.progress_bar.hide()  # 앱 실행 시 프로그레스 바를 숨깁니다.

        # Initialize variables
        self.video_file = video_file or None
        self.scale = "800"
        self.fps = "10"
        
        # If a video file was provided as an argument, set it in the UI
        if self.video_file:
            file_chooser_button = self.builder.get_object("file_chooser_button")
            if file_chooser_button:
                file_chooser_button.set_filename(self.video_file)
                self.on_file_set(file_chooser_button)  # Simulate a file set event
            else:
                print("file_chooser_button not found in the UI definition.")
                sys.exit(1)

    def on_cancel_btn_clicked(self, button):
        # 창을 닫습니다.
        self.window.destroy()

    # 파일 선택 시 호출되는 핸들러
    def on_file_set(self, file_chooser_button):
        self.video_file = file_chooser_button.get_filename()
        if not self.is_supported_file_type(self.video_file):
            self.display_error(_("Unsupported file extensions"))
            file_chooser_button.unselect_all()  # 파일 선택을 취소합니다.
            return  # 지원되지 않는 파일 형식이므로 여기서 리턴합니다.
    
    # 지원되는 파일 형식인지 확인하는 메서드
    def is_supported_file_type(self, filename):
        supported_extensions = ['.mp4', '.webm', '.avi', '.mkv']
        _, file_extension = os.path.splitext(filename)
        return file_extension.lower() in supported_extensions

    def on_convert_button_clicked(self, widget):
        if not self.video_file:
            self.display_error(_("No file selected. Please select a file."))
            return
        
        # Get the selected size ID from the comboboxtext_size widget
        size_combobox = self.builder.get_object("comboboxtext_size")
        selected_id = size_combobox.get_active_id()
        scale_option = f"scale={selected_id}:-1:flags=lanczos" if selected_id != "-1" else "scale=trunc(iw/2)*2:trunc(ih/2)*2"

        # palette_file 변수를 함수 시작 부분에서 초기화
        palette_file = None
        # Check if the palette check box is active
        palette_checkbox = self.builder.get_object("use_pallete")
        use_palette = palette_checkbox.get_active()

        # Build the ffmpeg command with the selected size
        output_file = os.path.splitext(self.video_file)[0] + ".gif"
        
        if use_palette:
            palette_file = os.path.splitext(self.video_file)[0] + "_palette.png"
            ffmpeg_command = [
                "ffmpeg",
                "-i", self.video_file,
                "-vf", f"{scale_option},palettegen",
                "-y", palette_file
            ]
            subprocess.run(ffmpeg_command, check=True)
            ffmpeg_command = [
                "ffmpeg",
                "-i", self.video_file,
                "-i", palette_file,
                "-lavfi", f"{scale_option} [x]; [x][1:v] paletteuse",
                "-y", output_file
            ]
        else:
            ffmpeg_command = [
                "ffmpeg",
                "-i", self.video_file,
                "-vf", f"fps={self.fps},{scale_option}",
                "-c:v", "gif",
                "-y", output_file
            ]

        # Run the ffmpeg command in a separate thread
        thread = threading.Thread(target=self.run_ffmpeg, args=(ffmpeg_command, output_file, use_palette, palette_file))
        thread.daemon = True  # 프로그램 종료 시 스레드도 함께 종료되도록 설정
        thread.start()

    def run_ffmpeg(self, command, output_file, use_palette, palette_file):
        # 프로그레스 바를 표시합니다.
        GLib.idle_add(self.progress_bar.set_visible, True)
        GLib.idle_add(self.progress_bar.set_fraction, 0.0)

        # 전체 프레임 수를 가져오기 위한 명령어 실행
        ffprobe_command = [
            "ffprobe",
            "-v", "error",
            "-select_streams", "v:0",
            "-count_frames",
            "-show_entries",
            "stream=nb_read_frames",
            "-of", "default=nokey=1:noprint_wrappers=1",
            self.video_file
        ]
        total_frames = subprocess.check_output(ffprobe_command, universal_newlines=True).strip()
        total_frames = int(total_frames) if total_frames.isdigit() else 0

        # ffmpeg 명령 실행
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
        frame_pattern = re.compile(r"frame=\s*(\d+)")

        for line in process.stdout:
            match = frame_pattern.search(line)
            if match:
                current_frame = int(match.group(1))
                fraction = current_frame / total_frames if total_frames else 0
                GLib.idle_add(self.progress_bar.set_fraction, fraction)

        process.stdout.close()
        return_code = process.wait()
        if return_code == 0:
            GLib.idle_add(self.display_info, _("Conversion completed successfully."))
        else:
            GLib.idle_add(self.display_error, _("An error occurred during conversion."))

        # 프로그레스 바를 숨깁니다.
        GLib.idle_add(self.progress_bar.set_visible, False)
        # 팔레트 파일이 있으면 제거합니다.
        if use_palette and os.path.isfile(palette_file):
            os.remove(palette_file)

        # Run the ffmpeg command
        # try:
        #     subprocess.run(ffmpeg_command, check=True)
        #     self.display_info(_("Conversion completed successfully."))
        #     # If a palette was used, remove the temporary palette file
        #     if use_palette and os.path.isfile(palette_file):
        #         os.remove(palette_file)
        # except subprocess.CalledProcessError as e:
        #     self.display_error(_("An error occurred: ") + str(e))
        #     # If a palette was used and an error occurred, remove the temporary palette file
        #     if use_palette and os.path.isfile(palette_file):
        #         os.remove(palette_file)


    def display_error(self, message):
        translated_message = _(message)
        dialog = Gtk.MessageDialog(
            self.window,
            0,
            Gtk.MessageType.ERROR,
            Gtk.ButtonsType.OK,
            _("Error"),
        )
        dialog.format_secondary_text(translated_message)
        dialog.run()
        dialog.destroy()

    def display_info(self, message):
        translated_message = _(message)
        dialog = Gtk.MessageDialog(
            self.window,
            0,
            Gtk.MessageType.INFO,
            Gtk.ButtonsType.OK,
            _("Info"),
        )
        dialog.format_secondary_text(translated_message)
        dialog.run()
        dialog.destroy()

    def on_window_destroy(self, widget):
        Gtk.main_quit()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Convert videos to GIF.')
    parser.add_argument('file', nargs='?', help='The video file to convert', default=None)
    args = parser.parse_args()

    app = Video2GIFConverter(video_file=args.file)
    Gtk.main()