#!/usr/bin/python3

import os
import subprocess
import sys
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib

import gettext
import locale

# 현재 스크립트의 디렉토리를 기준으로 번역 파일들의 경로를 설정합니다.
current_dir = os.path.dirname(os.path.abspath(__file__))
locale_path = os.path.join(current_dir, 'locale')
# 사용할 언어를 설정합니다. 'ko_KR'은 한국어를 의미합니다.
language = 'ko_KR.UTF8'
locale.setlocale(locale.LC_ALL, language)
locale.bindtextdomain('video2gif', locale_path)
gettext.textdomain('video2gif')

# 번역 함수를 가져옵니다.
_ = gettext.gettext

# 예시 사용: UI 요소의 레이블 설정
label_text = _("Video to GIF")
class Video2GIFConverter:
    def __init__(self):
        self.builder = Gtk.Builder()
        current_dir = os.path.dirname(os.path.abspath(__file__))
        ui_path = os.path.join(current_dir, "video2gif.ui")
        self.builder.add_from_file(ui_path)
        self.builder.connect_signals({
            "on_cancel_btn_clicked": self.on_cancel_btn_clicked,
            "on_window_destroy": self.on_window_destroy,
            # "on_file_select_button_clicked": self.on_file_select_button_clicked,
            "on_file_set": self.on_file_set, 
            "on_convert_button_clicked": self.on_convert_button_clicked,
        })
        # Get the palette checkbox and set it active
        palette_checkbox = self.builder.get_object("use_pallete")
        palette_checkbox.set_active(True)        
        self.window = self.builder.get_object("convert_dialog")
        self.window.show_all()
        
        # Initialize variables
        self.video_file = None
        self.scale = "800"
        self.fps = "10"

    def on_cancel_btn_clicked(self, button):
        # 창을 닫습니다.
        self.window.destroy()

    # 파일 선택 시 호출되는 핸들러
    def on_file_set(self, filechooserbutton):
        self.video_file = filechooserbutton.get_filename()
        if not self.is_supported_file_type(self.video_file):
            self.display_error("지원되지 않는 파일 형식입니다.")
            filechooserbutton.unselect_all()  # 파일 선택을 취소합니다.
            return  # 지원되지 않는 파일 형식이므로 여기서 리턴합니다.
    
    # 지원되는 파일 형식인지 확인하는 메서드
    def is_supported_file_type(self, filename):
        supported_extensions = ['.mp4', '.webm', '.avi', '.mkv']
        _, file_extension = os.path.splitext(filename)
        return file_extension.lower() in supported_extensions
            
    def on_convert_button_clicked(self, widget):
        if not self.video_file:
            self.display_error("No file selected. Please select a file.")
            return
        
        # Get the selected size from the comboboxtext_size widget
        size_combobox = self.builder.get_object("comboboxtext_size")
        selected_size = size_combobox.get_active_text()
        if selected_size == "Original":
            scale = -1  # Use original size
        else:
            scale = selected_size  # Use the selected size

        # Check if the palette check box is active
        palette_checkbox = self.builder.get_object("use_pallete")
        use_palette = palette_checkbox.get_active()

        # Build the ffmpeg command with the selected size
        output_file = os.path.splitext(self.video_file)[0] + ".gif"
        if use_palette:
            palette_file = os.path.splitext(self.video_file)[0] + "_palette.png"
            scale_option = f"scale={scale}:-1:flags=lanczos" if scale != -1 else "scale=trunc(iw/2)*2:trunc(ih/2)*2"
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
            scale_option = f"scale={scale}:-1:flags=lanczos" if scale != -1 else "scale=trunc(iw/2)*2:trunc(ih/2)*2"
            ffmpeg_command = [
                "ffmpeg",
                "-i", self.video_file,
                "-vf", f"fps={self.fps},{scale_option}",
                "-c:v", "gif",
                "-y", output_file
            ]

        # Run the ffmpeg command
        try:
            subprocess.run(ffmpeg_command, check=True)
            self.display_info("Conversion completed successfully.")
            # If a palette was used, remove the temporary palette file
            if use_palette and os.path.isfile(palette_file):
                os.remove(palette_file)
        except subprocess.CalledProcessError as e:
            self.display_error(f"An error occurred: {e}")
            # If a palette was used and an error occurred, remove the temporary palette file
            if use_palette and os.path.isfile(palette_file):
                os.remove(palette_file)

    def display_error(self, message):
        dialog = Gtk.MessageDialog(
            self.window,
            0,
            Gtk.MessageType.ERROR,
            Gtk.ButtonsType.OK,
            "Error",
        )
        dialog.format_secondary_text(message)
        dialog.run()
        dialog.destroy()

    def display_info(self, message):
        dialog = Gtk.MessageDialog(
            self.window,
            0,
            Gtk.MessageType.INFO,
            Gtk.ButtonsType.OK,
            "Info",
        )
        dialog.format_secondary_text(message)
        dialog.run()
        dialog.destroy()

    def on_window_destroy(self, widget):
        Gtk.main_quit()

if __name__ == "__main__":
    app = Video2GIFConverter()
    Gtk.main()
